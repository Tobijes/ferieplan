import type { VacationBalances } from ".";
import { Month, type MonthString } from "./month";

/** Epsilon for floating-point balance comparisons */
const EPS = 1e-9;

export class Account {
  readonly name: string;
  readonly months: Month[];
  readonly monthIndex: Record<MonthString, number>;
  readonly balance: number[];

  constructor(name: string, startMonth: Month, endMonth: Month) {
    this.name = name;
    this.months = startMonth.allMonthUntil(endMonth);
    this.monthIndex = Object.fromEntries(this.months.map((m, i) => [m, i]));
    this.balance = Array(this.months.length).fill(0);
  }

  clone(): Account {
    const copy = Object.create(Account.prototype) as Account;
    Object.assign(copy, {
      name: this.name,
      months: [...this.months],
      monthIndex: { ...this.monthIndex },
      balance: [...this.balance],
    });
    return copy;
  }

  has(month: Month): boolean {
    return month.key in this.monthIndex;
  }

  balanceAt(month: Month): number {
    if (this.has(month)) {
      return this.balance[this.monthIndex[month.key]];
    }
    return 0;
  }

  rollingAdd(month: Month, amount: number): void {
    this.applyRollingDelta(month, amount);
  }

  rollingSubtract(month: Month, amount: number): void {
    this.applyRollingDelta(month, -amount);
  }

  set(month: Month, amount: number): void {
    this.balance[this.monthIndex[month.key]] = amount;
  }

  isNegative(month: Month): boolean {
    return this.balance[this.monthIndex[month.key]] < -EPS;
  }
  isZero(month: Month): boolean {
    const balance = this.balance[this.monthIndex[month.key]];
    return -EPS < balance && balance < EPS;
  }

  private applyRollingDelta(month: Month, delta: number): void {
    const idx = this.monthIndex[month.key];
    if (idx === undefined) {
      throw new Error(`Month ${month} is outside this account's range`);
    }
    const snapToZero = (value: number) => (Math.abs(value) < EPS ? 0 : value);
    for (let i = idx; i < this.balance.length; i++) {
      this.balance[i] += delta;
      this.balance[i] = snapToZero(this.balance[i]);
    }
  }

  records(): Record<MonthString, number> {
    return Object.fromEntries(this.months.map((k, i) => [k, this.balance[i]]));
  }

  pprint(): void {
    const formatted = (n: number) => n.toFixed(2).padStart(7, " ");
    console.log(this.name);
    console.log(this.months.join(" "));
    console.log(this.balance.map(formatted).join(" "));
  }
}

export function prettyPrintAccounts(
  vacationBalances: VacationBalances
): void {
  const accounts = [
    vacationBalances.selectedAccount,
    ...vacationBalances.extraDaysAccounts,
    ...vacationBalances.vacationAccounts,
    vacationBalances.boughtDaysAccount,
    vacationBalances.lostDaysAccount,
    vacationBalances.transferDaysAccount,
  ]
  if (accounts.length === 0) return;

  // Deduplicate by key (string), then reconstruct sorted Month array
  const monthByKey = new Map<MonthString, Month>();
  for (const account of accounts) {
    for (const m of account.months) {
      if (!monthByKey.has(m.key)) monthByKey.set(m.key, m);
    }
  }
  const allMonths = [...monthByKey.values()].sort(Month.compare);

  const COL_WIDTH = 7;
  const LABEL_WIDTH = Math.max(...accounts.map((a) => a.name.length)) + 2;

  const header = allMonths.map((m) => m.short.padStart(COL_WIDTH)).join("");
  console.log("".padStart(LABEL_WIDTH) + header);

  for (const account of accounts) {
    const label = account.name.padEnd(LABEL_WIDTH);
    const values = allMonths
      .map((m) => {
        if (!(m.key in account.monthIndex)) return "".padStart(COL_WIDTH);
        const idx = account.monthIndex[m.key];
        return account.balance[idx].toFixed(2).padStart(COL_WIDTH);
      })
      .join("");
    console.log(label + values);
  }
}
