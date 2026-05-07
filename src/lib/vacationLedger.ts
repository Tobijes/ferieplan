import type { Holiday, VacationBalances, VacationState } from "@/types";
import { Account } from "@/types/account";
import { MonthName, Month } from "@/types/month";
import type { MonthString, DateString } from "@/types/month";

function createVacationYearAccount(
  startMonth: Month,
  initialVacationDays: number,
): Account {
  const endingMonth = new Month(
    startMonth.month < MonthName.SEPTEMBER
      ? startMonth.year
      : startMonth.year + 1,
    MonthName.DECEMBER,
  );

  const vacationYearActualStart = getPreviousMonthName(
    startMonth,
    MonthName.SEPTEMBER,
  );
  const name = `Ferieåret ${vacationYearActualStart.shortYear}/${vacationYearActualStart.addYears(1).shortYear}`;
  const account = new Account(name, startMonth, endingMonth);
  account.rollingAdd(startMonth, initialVacationDays);

  const obtainEndIndex = account.months.findIndex(
    (m) => m.year === endingMonth.year && m.month === MonthName.SEPTEMBER,
  );
  for (let i = 0; i < obtainEndIndex; i++) {
    account.rollingAdd(account.months[i], 2.08);
  }
  return account;
}

function createExtraDaysAccount(
  startMonth: Month,
  extraDaysCount: number,
): Account {
  const name = `Feriefridage ${startMonth.shortYear}/${startMonth.addYears(1).shortYear}`;
  const account = new Account(name, startMonth, startMonth.addMonths(11));
  account.rollingAdd(startMonth, extraDaysCount);
  return account;
}

function createSelectedAccount(
  startMonth: Month,
  endMonth: Month,
  dates: DateString[],
  holidays: Holiday[],
): Account {
  const enabledHolidays = new Set(
    holidays.filter((h) => h.enabled).map((h) => h.date),
  );
  const userMonthsList = [
    ...new Set(dates.filter((d) => !enabledHolidays.has(d))),
  ]
    .map((d) => new Month(d))
    .sort(Month.compare);
  const userMonths = userMonthsList.reduce<Record<MonthString, number>>(
    (acc, month) => {
      acc[month.key] = (acc[month.key] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const account = new Account("Brugervalg", startMonth, endMonth);
  for (const [monthString, value] of Object.entries(userMonths)) {
    account.set(new Month(monthString), value);
  }

  return account;
}

function getPreviousMonthName(month: Month, monthName: MonthName): Month {
  const year = month.month < monthName ? month.year - 1 : month.year;
  return new Month(year, monthName);
}

/* Given the start date, find the previous september */
function getStartMonth(startDate: DateString): Month {
  return new Month(startDate);
}

/* Given the holidays, find the last december */
function getEndMonth(startMonth: Month, holidays: Holiday[]): Month {
  const years = holidays.map((h) => new Month(h.date).year);
  const maxYear = years.length > 0 ? Math.max(...years) : startMonth.year;
  return new Month(maxYear, MonthName.DECEMBER);
}

export function computeBalances(state: VacationState): VacationBalances {
  const startMonth = getStartMonth(state.startDate);
  const endMonth = getEndMonth(startMonth, state.holidays);
  const allMonths = startMonth.allMonthUntil(endMonth);
  const selectedAccount = createSelectedAccount(
    startMonth,
    endMonth,
    state.selectedDates,
    state.holidays,
  );

  const vacationAccounts = [];
  const startingMonths = allMonths.filter(
    (m) => m.is(MonthName.SEPTEMBER) || m.equals(startMonth),
  );
  for (const [index, month] of startingMonths.entries()) {
    const initalDays = index == 0 ? state.initialVacationDays : 0;
    const account = createVacationYearAccount(month, initalDays);
    vacationAccounts.push(account);
  }

  const extraDaysAccounts = [];
  if (state.extraDaysCount > 0) {
    for (const month of allMonths.filter((m) =>
      m.is(state.extraDaysMonth as MonthName),
    )) {
      const account = createExtraDaysAccount(month, state.extraDaysCount);
      extraDaysAccounts.push(account);
    }
  }

  const accounts = [...extraDaysAccounts, ...vacationAccounts];

  const months = [
    ...new Set(accounts.flatMap((a) => a.months.map((m) => m.key))),
  ]
    .sort()
    .map((key) => new Month(key));

  const boughtDaysAccount = new Account(
    "Købte feriedage",
    startMonth,
    endMonth,
  );

  const lostDaysAccount = new Account("Tabte feriedage", startMonth, endMonth);
  const transferDaysAccount = new Account(
    "Overførte feriedage",
    startMonth,
    endMonth,
  );

  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    const priorMonth = month.addMonths(-1);
    const nextMonth = month.addMonths(1);
    // Check january transfer from previous month
    if (month.is(MonthName.JANUARY)) {
      // Find vacation account ending prior to this january
      const priorAcc = vacationAccounts.find(
        (acc) => acc.has(priorMonth) && !acc.has(nextMonth),
      );
      // Find vacation account that continues after prior
      const curAcc = vacationAccounts.find(
        (acc) => acc.has(month) && acc.has(nextMonth),
      );
      // Only transfer if positive
      if (
        curAcc !== undefined &&
        priorAcc !== undefined &&
        !priorAcc.isNegative(priorMonth)
      ) {
        const transfer = Math.min(
          state.maxTransferDays,
          priorAcc.balanceAt(priorMonth),
        );
        transferDaysAccount.set(priorMonth, transfer);
        const lost = priorAcc.balanceAt(priorMonth) - transfer;
        lostDaysAccount.set(priorMonth, lost);
        curAcc.rollingAdd(month, transfer);
      }
    }

    // Handle user selections
    if (selectedAccount.has(month)) {
      // Handle user selected days
      let remainder = selectedAccount.balanceAt(month);

      // Withdraw days from accounts prioritized by order. Only down to 0.
      const allAccountsWithMonth = accounts.filter((acc) => acc.has(month));
      for (const account of allAccountsWithMonth) {
        if (account.isZero(month) || account.isNegative(month)) {
          continue;
        }
        const currentBalance = account.balanceAt(month);
        const toSubtract = Math.min(remainder, currentBalance);
        remainder -= toSubtract;
        account.rollingSubtract(month, toSubtract);
      }

      // If we still have days left, we need to withdraw into advance days if allowed
      if (remainder > 0) {
        // Find the account for advance days: Last vacation days account (should be obtaining one)
        const account = vacationAccounts
          .filter((acc) => acc.has(month))
          .at(-1)!;

        // Find how close we are to the advance limit (balance is never positive)
        const advanceRemaining = Math.max(
          0,
          state.advanceDays + account.balanceAt(month),
        );
        // How much do we need to use and can we use
        const advanceToUse = Math.min(remainder, advanceRemaining);
        // Use the needed, up to limit
        account.rollingSubtract(month, advanceToUse);
        // The remainder has to be bought
        boughtDaysAccount.set(month, remainder - advanceToUse);
      }
    }
  }

  const balances: VacationBalances = {
    startMonth: startMonth,
    endMonth: endMonth,
    selectedAccount: selectedAccount,
    vacationAccounts: vacationAccounts,
    extraDaysAccounts: extraDaysAccounts,
    boughtDaysAccount: boughtDaysAccount,
    lostDaysAccount: lostDaysAccount,
    transferDaysAccount: transferDaysAccount

  }
  return balances;
}