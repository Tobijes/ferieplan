import { describe, it, expect } from 'vitest';
import {
  calculateEarnedDays,
  calculateExtraDays,
  countUsedDays,
  getBalance,
  computeAllStatuses,
  getFerieaarBalances,
  getFerieaarForDate,
} from './vacationCalculations';

describe('calculateEarnedDays', () => {
  it('returns 0 when target is before start', () => {
    expect(calculateEarnedDays('2026-06-01', '2026-05-01')).toBe(0);
  });

  it('returns 0 when target equals start', () => {
    expect(calculateEarnedDays('2026-06-01', '2026-06-01')).toBe(0);
  });

  it('earns 2.08 per month', () => {
    expect(calculateEarnedDays('2026-01-01', '2026-04-01')).toBeCloseTo(6.24); // 3 months
  });

  it('earns 24.96 for a full year', () => {
    expect(calculateEarnedDays('2026-01-01', '2027-01-01')).toBeCloseTo(24.96);
  });
});

describe('calculateExtraDays', () => {
  it('grants extra days when month is reached', () => {
    // Extra in May (month 5), start Jan 2026, target Jun 2026
    expect(calculateExtraDays('2026-01-01', '2026-06-01', 5, 5)).toBe(5);
  });

  it('does not grant extra days before the month', () => {
    expect(calculateExtraDays('2026-01-01', '2026-04-01', 5, 5)).toBe(0);
  });

  it('grants extra days for multiple years', () => {
    expect(calculateExtraDays('2026-01-01', '2027-06-01', 5, 5)).toBe(10);
  });

  it('does not grant if start is after extra month in same year', () => {
    expect(calculateExtraDays('2026-06-01', '2026-12-01', 5, 5)).toBe(0);
  });
});

describe('countUsedDays', () => {
  it('counts selected dates up to target', () => {
    const selected = ['2026-01-05', '2026-01-10', '2026-01-20'];
    expect(countUsedDays(selected, {}, '2026-01-10')).toBe(2);
  });

  it('excludes enabled holidays', () => {
    const selected = ['2026-01-05', '2026-01-10'];
    const holidays = { '2026-01-05': true };
    expect(countUsedDays(selected, holidays, '2026-01-10')).toBe(1);
  });

  it('returns 0 when no dates selected', () => {
    expect(countUsedDays([], {}, '2026-01-10')).toBe(0);
  });
});

describe('getBalance', () => {
  it('returns initial days when no time elapsed and nothing used', () => {
    expect(getBalance('2026-01-01', 10, 5, 5, [], {}, '2026-01-01')).toBe(10);
  });

  it('accrues days over time', () => {
    const bal = getBalance('2026-01-01', 0, 5, 5, [], {}, '2026-04-01');
    expect(bal).toBeCloseTo(6.24); // 3 months × 2.08
  });

  it('subtracts used days', () => {
    const selected = ['2026-02-02', '2026-02-03'];
    const bal = getBalance('2026-01-01', 10, 5, 5, selected, {}, '2026-03-01');
    // 10 + 2*2.08 + 0 - 2 = 12.16
    expect(bal).toBeCloseTo(12.16);
  });

  it('includes extra days when month is reached', () => {
    const bal = getBalance('2026-01-01', 0, 5, 5, [], {}, '2026-06-01');
    // 5*2.08 + 5 = 15.4
    expect(bal).toBeCloseTo(15.4);
  });
});

describe('computeAllStatuses', () => {
  it('marks holidays correctly', () => {
    const result = computeAllStatuses(
      ['2026-01-01'],
      [],
      { '2026-01-01': true },
      '2026-01-01', 0, 5, 5, 0
    );
    expect(result['2026-01-01']).toBe('holiday');
  });

  it('marks weekends correctly', () => {
    // 2026-01-03 is a Saturday
    const result = computeAllStatuses(
      ['2026-01-03'],
      [],
      {},
      '2026-01-01', 0, 5, 5, 0
    );
    expect(result['2026-01-03']).toBe('weekend');
  });

  it('marks selected days as ok when balance positive', () => {
    // 2026-01-05 is Monday
    const result = computeAllStatuses(
      ['2026-01-05'],
      ['2026-01-05'],
      {},
      '2026-01-01', 10, 5, 5, 0
    );
    expect(result['2026-01-05']).toBe('selected-ok');
  });

  it('marks selected days as overdrawn when no balance and no advance', () => {
    const result = computeAllStatuses(
      ['2026-01-05'],
      ['2026-01-05'],
      {},
      '2026-01-01', 0, 5, 5, 0
    );
    expect(result['2026-01-05']).toBe('selected-overdrawn');
  });

  it('marks selected days as warning when within advance days', () => {
    const result = computeAllStatuses(
      ['2026-01-05'],
      ['2026-01-05'],
      {},
      '2026-01-01', 0, 5, 5, 5
    );
    expect(result['2026-01-05']).toBe('selected-warning');
  });

  it('marks normal weekdays', () => {
    const result = computeAllStatuses(
      ['2026-01-05'],
      [],
      {},
      '2026-01-01', 0, 5, 5, 0
    );
    expect(result['2026-01-05']).toBe('normal');
  });
});

describe('getFerieaarForDate', () => {
  it('Jan-Aug maps to previous year', () => {
    expect(getFerieaarForDate('2026-01-15')).toBe(2025);
    expect(getFerieaarForDate('2026-08-31')).toBe(2025);
  });

  it('Sep-Dec maps to same year', () => {
    expect(getFerieaarForDate('2026-09-01')).toBe(2026);
    expect(getFerieaarForDate('2026-12-31')).toBe(2026);
  });
});

describe('getFerieaarBalances', () => {
  it('single ferieår: basic accrual', () => {
    // Start Sep 2025, check at Jan 2026 = 4 months elapsed in ferieår 2025
    const balances = getFerieaarBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2026-01-01'
    );
    expect(balances).toHaveLength(1);
    expect(balances[0].year).toBe(2025);
    expect(balances[0].earned).toBeCloseTo(8.32); // 4 months × 2.08
    expect(balances[0].used).toBe(0);
    expect(balances[0].expired).toBe(false);
  });

  it('initial days go to earliest ferieår', () => {
    const balances = getFerieaarBalances(
      '2025-09-01', 10, 5, 5, [], {}, '2026-01-01'
    );
    expect(balances[0].balance).toBeCloseTo(10 + 8.32);
  });

  it('allocates used days to earliest ferieår first', () => {
    // Two ferieår active: 2025 (usable until Dec 2026) and 2026 (usable until Dec 2027)
    // Start Sep 2025, check at Nov 2026 (ferieår 2025 and 2026 both active)
    const selected = ['2026-10-01', '2026-10-02']; // In ferieår 2026 obtain period
    const balances = getFerieaarBalances(
      '2025-09-01', 5, 5, 5, selected, {}, '2026-11-01'
    );
    // Should consume from ferieår 2025 first (earliest)
    expect(balances[0].used).toBe(2);
    expect(balances[1].used).toBe(0);
  });

  it('transfer: up to 5 days carry over, excess is lost', () => {
    // Ferieår 2025 expires Dec 31, 2026. Check at Jan 2027.
    // Give enough initial days so ferieår 2025 has > 5 remaining
    const balances = getFerieaarBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2027-01-01'
    );
    const fy2025 = balances.find(b => b.year === 2025)!;
    const fy2026 = balances.find(b => b.year === 2026)!;
    expect(fy2025.expired).toBe(true);
    // Ferieår 2025 earns 12×2.08=24.96 + extra 5 = 29.96
    expect(fy2025.earned).toBeCloseTo(24.96);
    expect(fy2025.lost).toBeCloseTo(29.96 - 5); // 24.96 lost
    expect(fy2026.transferred).toBe(5); // max 5 transferred
  });

  it('transfer: no loss when remaining ≤ 5', () => {
    // Use enough days from ferieår 2025 so only 3 remain
    // Ferieår 2025: 24.96 earned + 5 extra = 29.96, use 27 → 2.96 left
    const selected: string[] = [];
    // Generate 27 weekday dates in ferieår 2025 usable period (2025-09 to 2026-12)
    let count = 0;
    for (let m = 9; m <= 12 && count < 27; m++) {
      for (let d = 1; d <= 28 && count < 27; d++) {
        const dt = new Date(2025, m - 1, d);
        if (dt.getDay() !== 0 && dt.getDay() !== 6) {
          selected.push(`2025-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
          count++;
        }
      }
    }
    const balances = getFerieaarBalances(
      '2025-09-01', 0, 5, 5, selected, {}, '2027-01-01'
    );
    const fy2025 = balances.find(b => b.year === 2025)!;
    // 29.96 - 27 = 2.96 remaining, all transferable
    expect(fy2025.balance).toBeCloseTo(2.96);
    expect(fy2025.lost).toBe(0);
    const fy2026 = balances.find(b => b.year === 2026)!;
    expect(fy2026.transferred).toBeCloseTo(2.96);
  });

  it('extra days assigned to correct ferieår', () => {
    // Extra in May (month 5). Ferieår 2025 obtain: Sep 2025-Aug 2026 → May 2026 is in it
    const balances = getFerieaarBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2026-06-01'
    );
    expect(balances[0].extra).toBe(5);
  });

  it('ferieår expiry: days from ferieår 2025 expire after 2026-12-31', () => {
    const balances = getFerieaarBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2027-01-01'
    );
    const fy2025 = balances.find(b => b.year === 2025)!;
    expect(fy2025.expired).toBe(true);
  });

  it('advance days: overdrawn status works with per-ferieår model', () => {
    const result = computeAllStatuses(
      ['2026-01-05'],
      ['2026-01-05'],
      {},
      '2026-01-01', 0, 5, 5, 0
    );
    expect(result['2026-01-05']).toBe('selected-overdrawn');
  });

  it('advance days: NaN advanceDays treated as 0', () => {
    const selected = ['2026-02-02'];
    const rNaN = computeAllStatuses(selected, selected, {}, '2026-02-01', 0, 5, 5, NaN);
    // NaN comparison: -1 >= NaN is false → should be overdrawn
    expect(rNaN['2026-02-02']).toBe('selected-overdrawn');
  });

  it('advance days: realistic scenario with startDate today', () => {
    // Simulate user starting Feb 2026, selecting many days in Feb that exceed balance
    // Ferieår 2025: earned from Feb to Feb = 0 months = 0 days
    // With initialDays=0 and 1 selected day, balance = -1
    const selected = ['2026-02-02'];
    const r0 = computeAllStatuses(selected, selected, {}, '2026-02-01', 0, 5, 5, 0);
    expect(r0['2026-02-02']).toBe('selected-overdrawn');

    const r5 = computeAllStatuses(selected, selected, {}, '2026-02-01', 0, 5, 5, 5);
    expect(r5['2026-02-02']).toBe('selected-warning');
  });

  it('advance days: changing forskudsferie turns overdrawn into warning', () => {
    // Start Feb 2026, select 5 days in Mar. Earned by Mar = 1 month × 2.08 = 2.08
    // After 3rd day used, balance = 2.08 - 3 = -0.92 → overdrawn with advanceDays=0
    const selected = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06'];
    const allDates = selected;

    const r0 = computeAllStatuses(allDates, selected, {}, '2026-02-01', 0, 5, 5, 0);
    // 3rd day: balance = 2.08 - 3 = -0.92 → overdrawn
    expect(r0['2026-03-04']).toBe('selected-overdrawn');

    const r5 = computeAllStatuses(allDates, selected, {}, '2026-02-01', 0, 5, 5, 5);
    // Same scenario but advance=5, so -0.92 >= -5 → warning
    expect(r5['2026-03-04']).toBe('selected-warning');
  });
});
