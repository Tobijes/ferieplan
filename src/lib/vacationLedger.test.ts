import { describe, it, expect } from "vitest";
import { computeBalances } from "./vacationLedger";
import type { Holiday, VacationState } from "@/types";
import defaultData from "../../public/default.json";

/** Build a VacationState from default.json with optional overrides */
function makeState(overrides: Partial<VacationState> = {}): VacationState {
  return {
    ...defaultData,
    ...overrides,
  } as VacationState;
}

/** Extract a plain record from an Account for structural comparison */
function rec(account: { records: () => Record<string, number> }) {
  return account.records();
}

/** Find an account by exact name match */
function findAccount(
  balances: ReturnType<typeof computeBalances>,
  name: string,
) {
  return [
    balances.selectedAccount,
    ...balances.extraDaysAccounts,
    ...balances.vacationAccounts,
    balances.boughtDaysAccount,
    balances.lostDaysAccount,
    balances.transferDaysAccount,
  ].find((a) => a.name === name);
}

/** Generate N non-holiday weekdays starting from a given month */
function generateWeekdays(
  year: number,
  month: number,
  count: number,
  holidays: Holiday[] = defaultData.holidays,
): string[] {
  const enabledHolidays = new Set(
    holidays.filter((h) => h.enabled).map((h) => h.date),
  );
  const dates: string[] = [];
  for (let d = 1; d <= 31 && dates.length < count; d++) {
    const dt = new Date(year, month - 1, d);
    if (dt.getMonth() !== month - 1) break;
    if (dt.getDay() === 0 || dt.getDay() === 6) continue;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (enabledHolidays.has(iso)) continue;
    dates.push(iso);
  }
  if (dates.length < count) {
    throw new Error(
      `Only found ${dates.length} non-holiday weekdays in ${year}-${month}, needed ${count}`,
    );
  }
  return dates;
}

describe("vacationLedger - basic structure", () => {
  it("creates correct vacation year accounts with no selections", () => {
    const balances = computeBalances(makeState({ selectedDates: [] }));

    expect(balances.vacationAccounts).toHaveLength(3);
    expect(balances.vacationAccounts[0].name).toBe("Ferieåret 25/26");
    expect(balances.vacationAccounts[1].name).toBe("Ferieåret 26/27");
    expect(balances.vacationAccounts[2].name).toBe("Ferieåret 27/28");
  });

  it("creates correct extra days accounts with default config", () => {
    const balances = computeBalances(makeState({ selectedDates: [] }));

    // Default extraDaysMonth=5, range 2025-09→2027-12 → May 2026 and May 2027
    expect(balances.extraDaysAccounts).toHaveLength(2);
    expect(balances.extraDaysAccounts[0].name).toBe("Feriefridage 26/27");
    expect(balances.extraDaysAccounts[1].name).toBe("Feriefridage 27/28");
  });

  it("has zero selected and bought with no selections", () => {
    const balances = computeBalances(makeState({ selectedDates: [] }));

    expect(
      Object.values(rec(balances.selectedAccount)).every((v) => v === 0),
    ).toBe(true);
    expect(
      Object.values(rec(balances.boughtDaysAccount)).every((v) => v === 0),
    ).toBe(true);
  });
});

describe("vacationLedger - ferieår earning", () => {
  it("accrues 2.08 per month for 12 months in obtain period", () => {
    const balances = computeBalances(makeState({ selectedDates: [] }));
    const vy2526 = findAccount(balances, "Ferieåret 25/26")!;
    const r = rec(vy2526);

    // First month (2025-09): 2.08
    expect(r["2025-09"]).toBeCloseTo(2.08);
    // Second month (2025-10): 4.16
    expect(r["2025-10"]).toBeCloseTo(4.16);
    // 12th month (2026-08): 24.96
    expect(r["2026-08"]).toBeCloseTo(24.96);
    // After obtain period ends (2026-09 onwards): stays at 24.96
    expect(r["2026-09"]).toBeCloseTo(24.96);
    expect(r["2026-12"]).toBeCloseTo(24.96);
  });

  it("adds initialVacationDays to earliest ferieår only", () => {
    const balances = computeBalances(
      makeState({ selectedDates: [], initialVacationDays: 10 }),
    );
    const vy2526 = findAccount(balances, "Ferieåret 25/26")!;
    const vy2627 = findAccount(balances, "Ferieåret 26/27")!;

    // Earliest year gets +10 at start
    expect(rec(vy2526)["2025-09"]).toBeCloseTo(10 + 2.08);
    // Next year unchanged
    expect(rec(vy2627)["2026-09"]).toBeCloseTo(2.08);
  });
});

describe("vacationLedger - extra days (6. ferieuge)", () => {
  it("grants extraDaysCount on grant month and carries forward", () => {
    const balances = computeBalances(makeState({ selectedDates: [] }));
    const extra2627 = findAccount(balances, "Feriefridage 26/27")!;
    const r = rec(extra2627);

    // Granted May 2026, usable through Apr 2027
    expect(r["2026-05"]).toBeCloseTo(5);
    expect(r["2026-12"]).toBeCloseTo(5);
    expect(r["2027-04"]).toBeCloseTo(5);
  });

  it("skips extra days accounts when extraDaysCount is 0", () => {
    const balances = computeBalances(
      makeState({ selectedDates: [], extraDaysCount: 0 }),
    );
    expect(balances.extraDaysAccounts).toHaveLength(0);
  });
});

describe("vacationLedger - allocation waterfall", () => {
  it("consumes from extra pool before ferieår", () => {
    // 2026-05-05 is a Tuesday, not a holiday
    const balances = computeBalances(
      makeState({ selectedDates: ["2026-05-05"] }),
    );
    const extra2627 = findAccount(balances, "Feriefridage 26/27")!;
    const vy2526 = findAccount(balances, "Ferieåret 25/26")!;

    // Extra pool absorbs the day (5 → 4)
    expect(rec(extra2627)["2026-05"]).toBeCloseTo(4);
    // Ferieåret untouched at 2026-05 (earned 9 months = 9×2.08 = 18.72)
    expect(rec(vy2526)["2026-05"]).toBeCloseTo(18.72);
  });

  it("falls through to earliest positive ferieår when extras exhausted", () => {
    // Select 6 weekdays in May 2026 to exhaust the 5 extra days
    const dates = generateWeekdays(2026, 5, 6);
    const balances = computeBalances(makeState({ selectedDates: dates }));
    const extra2627 = findAccount(balances, "Feriefridage 26/27")!;
    const vy2526 = findAccount(balances, "Ferieåret 25/26")!;

    // All 5 extras used
    expect(rec(extra2627)["2026-05"]).toBeCloseTo(0);
    // 1 day from earliest positive ferieår (vy2526 has 18.72 at 2026-05)
    expect(rec(vy2526)["2026-05"]).toBeCloseTo(17.72);
    // vy2627 does not cover 2026-05 (starts at 2026-09)
  });

  it("splits selection across years when earliest has partial balance", () => {
    // Select 2 days each month Sep 2025–Aug 2026 (24 days total).
    // vy2526 earns 2.08/month. After using 2.08 each month, residual builds:
    // 0.08, 0.16, 0.24, ..., 0.96 at Aug 2026.
    // Then 1 day in Sep 2026 → 0.96 from vy2526, 0.04 from vy2627.
    const selected: string[] = [];
    for (let m = 9; m <= 12; m++) selected.push(...generateWeekdays(2025, m, 2));
    for (let m = 1; m <= 8; m++) selected.push(...generateWeekdays(2026, m, 2));
    selected.push(...generateWeekdays(2026, 9, 1));

    const balances = computeBalances(
      makeState({ selectedDates: selected, extraDaysCount: 0 }),
    );
    const vy2526 = findAccount(balances, "Ferieåret 25/26")!;
    const vy2627 = findAccount(balances, "Ferieåret 26/27")!;

    // vy2526 exhausted at Sep 2026 (0.96 − 0.96 = 0)
    expect(rec(vy2526)["2026-09"]).toBeCloseTo(0);
    // vy2627 contributed 0.04
    expect(rec(vy2627)["2026-09"]).toBeCloseTo(2.04);
  });
});

describe("vacationLedger - transfer on expiry", () => {
  it("transfers up to maxTransferDays to next ferieår in January", () => {
    // No selections — vy2526 has full 24.96 at Dec 2026
    // Transfer in Jan 2027 = min(5, 24.96) = 5
    const balances = computeBalances(makeState({ selectedDates: [] }));
    const vy2627 = findAccount(balances, "Ferieåret 26/27")!;
    const transfer = findAccount(balances, "Overførte feriedage")!;
    const lost = findAccount(balances, "Tabte feriedage")!;

    // Transfer recorded at Dec 2026 (month before Jan 2027)
    expect(rec(transfer)["2026-12"]).toBeCloseTo(5);
    // Lost = 24.96 - 5 = 19.96
    expect(rec(lost)["2026-12"]).toBeCloseTo(19.96);
    // vy2627 gets +5 starting Jan 2027
    // vy2627 at 2027-01: earned 5*2.08=10.4 + transfer 5 = 15.4
    expect(rec(vy2627)["2027-01"]).toBeCloseTo(15.4);
  });

  it("transfers exact balance when less than maxTransferDays", () => {
    // Use 5 days/month Sep 2025–Jun 2026 (10 months) to reduce vy2526 balance.
    // vy2526 loses 10×2.08 = 20.8. Balance at Dec 2026 = 24.96 − 20.8 = 4.16.
    const selected: string[] = [];
    for (let m = 9; m <= 12; m++) selected.push(...generateWeekdays(2025, m, 5));
    for (let m = 1; m <= 6; m++) selected.push(...generateWeekdays(2026, m, 5));

    const balances = computeBalances(
      makeState({ selectedDates: selected, extraDaysCount: 0 }),
    );
    const transfer = findAccount(balances, "Overførte feriedage")!;
    const lost = findAccount(balances, "Tabte feriedage")!;
    const vy2627 = findAccount(balances, "Ferieåret 26/27")!;

    // 4.16 remaining → all transferred (≤ 5)
    expect(rec(transfer)["2026-12"]).toBeCloseTo(4.16);
    expect(rec(lost)["2026-12"]).toBeCloseTo(0);
    // vy2627 Jan 2027: 10.4 + 4.16
    expect(rec(vy2627)["2027-01"]).toBeCloseTo(14.56);
  });

  it("does not transfer when balance is zero or negative", () => {
    // Use 5 days/month Sep 2025–Aug 2026 (12 months) to exhaust vy2526.
    // vy2526 loses 12×2.08 = 24.96. Balance = 0.
    const selected: string[] = [];
    for (let m = 9; m <= 12; m++) selected.push(...generateWeekdays(2025, m, 5));
    for (let m = 1; m <= 8; m++) selected.push(...generateWeekdays(2026, m, 5));

    const balances = computeBalances(
      makeState({ selectedDates: selected, extraDaysCount: 0 }),
    );
    const transfer = findAccount(balances, "Overførte feriedage")!;
    const lost = findAccount(balances, "Tabte feriedage")!;

    // Balance is zero, no transfer
    expect(rec(transfer)["2026-12"]).toBeCloseTo(0);
    expect(rec(lost)["2026-12"]).toBeCloseTo(0);
  });

  it("does not include extra pool balance in transfer", () => {
    // Extras are independent — verify they don't affect transfer calculation
    const balances = computeBalances(makeState({ selectedDates: [] }));
    const transfer = findAccount(balances, "Overførte feriedage")!;
    const lost = findAccount(balances, "Tabte feriedage")!;

    // Transfer is based only on earned days (24.96), not extras
    expect(rec(transfer)["2026-12"]).toBeCloseTo(5);
    expect(rec(lost)["2026-12"]).toBeCloseTo(19.96);
  });

  it("transfers initialVacationDays along with earned days", () => {
    // With initialVacationDays=10, vy2526 balance at Dec 2026 = 34.96
    // Transfer = min(5, 34.96) = 5 (initial days are transferable)
    const balances = computeBalances(
      makeState({ selectedDates: [], initialVacationDays: 10 }),
    );
    const transfer = findAccount(balances, "Overførte feriedage")!;
    const lost = findAccount(balances, "Tabte feriedage")!;

    expect(rec(transfer)["2026-12"]).toBeCloseTo(5);
    expect(rec(lost)["2026-12"]).toBeCloseTo(29.96); // 34.96 - 5
  });
});

describe("vacationLedger - borrowing (forskudsferie)", () => {
  it("borrows within advanceDays limit", () => {
    // Select 5 days in Sep 2025. Earned = 2.08. advanceDays = 5.
    const balances = computeBalances(
      makeState({
        selectedDates: generateWeekdays(2025, 9, 5),
        advanceDays: 5,
      }),
    );
    const vy2526 = findAccount(balances, "Ferieåret 25/26")!;
    const bought = findAccount(balances, "Købte feriedage")!;

    // 2.08 earned, 5 selected. 2.08 from balance, 2.92 borrowed (within 5 limit)
    expect(rec(vy2526)["2025-09"]).toBeCloseTo(-2.92);
    // Nothing bought since all within advance
    expect(rec(bought)["2025-09"]).toBeCloseTo(0);
  });

  it("records bought days when exceeding advanceDays", () => {
    // Select 10 days in Sep 2025. Earned = 2.08. advanceDays = 5.
    const balances = computeBalances(
      makeState({
        selectedDates: generateWeekdays(2025, 9, 10),
        advanceDays: 5,
      }),
    );
    const vy2526 = findAccount(balances, "Ferieåret 25/26")!;
    const bought = findAccount(balances, "Købte feriedage")!;

    // 2.08 earned, 10 selected.
    // 2.08 from balance, 5 borrowed (advance limit), 2.92 bought
    expect(rec(vy2526)["2025-09"]).toBeCloseTo(2.08 - 2.08 - 5);
    expect(rec(bought)["2025-09"]).toBeCloseTo(2.92);
  });

  it("records all excess as bought when advanceDays is 0", () => {
    // Select 3 days in Sep 2025. Earned = 2.08. advanceDays = 0.
    const balances = computeBalances(
      makeState({
        selectedDates: generateWeekdays(2025, 9, 3),
        advanceDays: 0,
      }),
    );
    const vy2526 = findAccount(balances, "Ferieåret 25/26")!;
    const bought = findAccount(balances, "Købte feriedage")!;

    // 2.08 earned, 3 selected. 2.08 used, 0.92 bought
    expect(rec(vy2526)["2025-09"]).toBeCloseTo(0);
    expect(rec(bought)["2025-09"]).toBeCloseTo(0.92);
  });
});

describe("vacationLedger - holiday handling", () => {
  it("excludes enabled holidays from selection consumption", () => {
    // 2025-12-25 is an enabled holiday (1. juledag)
    const balances = computeBalances(
      makeState({ selectedDates: ["2025-12-25"] }),
    );
    const selected = findAccount(balances, "Brugervalg")!;
    const vy2526 = findAccount(balances, "Ferieåret 25/26")!;

    // Holiday filtered out — no selection recorded
    expect(rec(selected)["2025-12"]).toBeCloseTo(0);
    // Vacation year untouched at 2025-12 (earned 4 months = 8.32)
    expect(rec(vy2526)["2025-12"]).toBeCloseTo(8.32);
  });

  it("includes disabled holidays in selection and consumes balance", () => {
    // 2026-05-01 is a disabled holiday (1. Maj)
    const balances = computeBalances(
      makeState({ selectedDates: ["2026-05-01"] }),
    );
    const selected = findAccount(balances, "Brugervalg")!;
    const extra2627 = findAccount(balances, "Feriefridage 26/27")!;

    // Disabled holiday treated as normal day
    expect(rec(selected)["2026-05"]).toBeCloseTo(1);
    // Consumes from extra pool first
    expect(rec(extra2627)["2026-05"]).toBeCloseTo(4);
  });
});

describe("vacationLedger - end-to-end scenarios", () => {
  it("complex scenario: mixed selections across years with transfer", () => {
    const selected = [
      "2025-09-01", // Mon — consumes from vy2526
      "2025-09-02", // Tue
      "2026-05-05", // Tue — consumes from extra2627 first
      "2026-05-06", // Wed
      "2026-09-01", // Tue — consumes from extra2627 first (still active)
    ];
    const balances = computeBalances(makeState({ selectedDates: selected }));
    const vy2526 = findAccount(balances, "Ferieåret 25/26")!;
    const vy2627 = findAccount(balances, "Ferieåret 26/27")!;
    const extra2627 = findAccount(balances, "Feriefridage 26/27")!;

    // vy2526: 2 days in Sep 2025 (2.08 − 2 = 0.08)
    expect(rec(vy2526)["2025-09"]).toBeCloseTo(0.08);
    // vy2526 at 2026-09: 24.96 − 2 = 22.96 (Sep 2026 day comes from extras)
    expect(rec(vy2526)["2026-09"]).toBeCloseTo(22.96);

    // vy2627: Sep 2026 day consumed from extras first, so vy2627 untouched at 2026-09
    expect(rec(vy2627)["2026-09"]).toBeCloseTo(2.08);

    // extra2627: 2 days in May 2026 + 1 day in Sep 2026 = 3 days used
    // May 2026 balance: 5 − 2 = 3; Sep 2026 balance: 3 − 1 = 2
    expect(rec(extra2627)["2026-05"]).toBeCloseTo(3);
    expect(rec(extra2627)["2026-09"]).toBeCloseTo(2);
  });
});
