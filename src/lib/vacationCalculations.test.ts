import { describe, it, expect } from 'vitest';
import {
  computeAllStatuses,
  getVacationYearBalances,
  getVacationYearForDate,
  classifyStaticDates,
  buildTimelineEvents,
  applyEvent,
  allocateDay,
  computeTotalActiveBalance,
  statusFromBalance,
} from './vacationCalculations';
import type { VacationYearState, TimelineEvent } from './vacationCalculations';

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
    // With startDate Jan 1, Jan has 2.08 days available. Select 3 days to exceed balance.
    const selected = ['2026-01-05', '2026-01-06', '2026-01-07'];
    const result = computeAllStatuses(
      selected,
      selected,
      {},
      '2026-01-01', 0, 5, 5, 0
    );
    // 3rd day: balance = 2.08 - 3 = -0.92 → overdrawn
    expect(result['2026-01-07']).toBe('selected-overdrawn');
  });

  it('marks selected days as warning when within advance days', () => {
    // With startDate Jan 1, Jan has 2.08 days. Select 3 days, 3rd is in advance.
    const selected = ['2026-01-05', '2026-01-06', '2026-01-07'];
    const result = computeAllStatuses(
      selected,
      selected,
      {},
      '2026-01-01', 0, 5, 5, 5
    );
    // 3rd day: balance = 2.08 - 3 = -0.92, within advance (5) → warning
    expect(result['2026-01-07']).toBe('selected-warning');
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

describe('getVacationYearForDate', () => {
  it('Jan-Aug maps to previous year', () => {
    expect(getVacationYearForDate('2026-01-15')).toBe(2025);
    expect(getVacationYearForDate('2026-08-31')).toBe(2025);
  });

  it('Sep-Dec maps to same year', () => {
    expect(getVacationYearForDate('2026-09-01')).toBe(2026);
    expect(getVacationYearForDate('2026-12-31')).toBe(2026);
  });
});

describe('getVacationYearBalances', () => {
  it('single vacation year: basic accrual', () => {
    // Start Sep 2025, check at Jan 2026 = 5 months available (Sep-Jan, days credited at start of month)
    const balances = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2026-01-01'
    );
    expect(balances).toHaveLength(1);
    expect(balances[0].year).toBe(2025);
    expect(balances[0].earned).toBeCloseTo(10.4); // 5 months × 2.08 (Sep, Oct, Nov, Dec, Jan)
    expect(balances[0].used).toBe(0);
    expect(balances[0].expired).toBe(false);
  });

  it('initial days go to earliest vacation year', () => {
    const balances = getVacationYearBalances(
      '2025-09-01', 10, 5, 5, [], {}, '2026-01-01'
    );
    expect(balances[0].balance).toBeCloseTo(10 + 10.4); // 5 months × 2.08
  });

  it('allocates used days to earliest vacation year first', () => {
    // Two vacation years active: 2025 (usable until Dec 2026) and 2026 (usable until Dec 2027)
    // Start Sep 2025, check at Nov 2026 (vacation year 2025 and 2026 both active)
    const selected = ['2026-10-01', '2026-10-02']; // In vacation year 2026 obtain period
    const balances = getVacationYearBalances(
      '2025-09-01', 5, 5, 5, selected, {}, '2026-11-01'
    );
    // Should consume from vacation year 2025 first (earliest)
    expect(balances[0].used).toBe(2);
    expect(balances[1].used).toBe(0);
  });

  it('splits used days across years when earliest year has partial balance', () => {
    // Start Sep 2025, check at Nov 2026
    // vy2025: 12 months × 2.08 = 24.96 earned + 5 extra = 29.96 total
    // Use 29 weekdays first, then 1 more that should split: 0.96 from vy2025, 0.04 from vy2026
    const selected: string[] = [];
    let count = 0;
    for (let m = 9; m <= 12 && count < 29; m++) {
      for (let d = 1; d <= 28 && count < 29; d++) {
        const dt = new Date(2025, m - 1, d);
        if (dt.getDay() !== 0 && dt.getDay() !== 6) {
          selected.push(`2025-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
          count++;
        }
      }
    }
    // Add one more day in Oct 2026 (overlapping period)
    selected.push('2026-10-01');

    const balances = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, selected, {}, '2026-11-01'
    );
    const vy2025 = balances.find(b => b.year === 2025)!;
    const vy2026 = balances.find(b => b.year === 2026)!;

    // vy2025: 29.96 total, used 29 + 0.96 = 29.96
    expect(vy2025.used).toBeCloseTo(29.96);
    // vy2026: used remainder 0.04
    expect(vy2026.used).toBeCloseTo(0.04);
  });

  it('transfer: up to 5 days carry over, excess is lost', () => {
    // Vacation year 2025 expires Dec 31, 2026. Check at Jan 2027.
    // Give enough initial days so vacation year 2025 has > 5 remaining
    const balances = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2027-01-01'
    );
    const vy2025 = balances.find(b => b.year === 2025)!;
    const vy2026 = balances.find(b => b.year === 2026)!;
    expect(vy2025.expired).toBe(true);
    // Vacation year 2025 earns 12×2.08=24.96 + extra 5 = 29.96
    expect(vy2025.earned).toBeCloseTo(24.96);
    expect(vy2025.lost).toBeCloseTo(29.96 - 5); // 24.96 lost
    expect(vy2026.transferred).toBe(5); // max 5 transferred
  });

  it('transfer: no loss when remaining ≤ 5', () => {
    // Use enough days from vacation year 2025 so only 3 remain
    // Vacation year 2025: 24.96 earned + 5 extra = 29.96, use 27 → 2.96 left
    const selected: string[] = [];
    // Generate 27 weekday dates in vacation year 2025 usable period (2025-09 to 2026-12)
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
    const balances = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, selected, {}, '2027-01-01'
    );
    const vy2025 = balances.find(b => b.year === 2025)!;
    // 29.96 - 27 = 2.96 remaining, all transferable
    expect(vy2025.balance).toBeCloseTo(2.96);
    expect(vy2025.lost).toBe(0);
    const vy2026 = balances.find(b => b.year === 2026)!;
    expect(vy2026.transferred).toBeCloseTo(2.96);
  });

  it('extra days assigned to correct vacation year', () => {
    // Extra in May (month 5). Vacation year 2025 obtain: Sep 2025-Aug 2026 → May 2026 is in it
    const balances = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2026-06-01'
    );
    expect(balances[0].extra).toBe(5);
  });

  it('vacation year expiry: days from vacation year 2025 expire after 2026-12-31', () => {
    const balances = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2027-01-01'
    );
    const vy2025 = balances.find(b => b.year === 2025)!;
    expect(vy2025.expired).toBe(true);
  });

  it('advance days: overdrawn status works with per-vacation-year model', () => {
    // Select 3 days when only 2.08 available → 3rd day overdrawn
    const selected = ['2026-01-05', '2026-01-06', '2026-01-07'];
    const result = computeAllStatuses(
      selected,
      selected,
      {},
      '2026-01-01', 0, 5, 5, 0
    );
    expect(result['2026-01-07']).toBe('selected-overdrawn');
  });

  it('advance days: NaN advanceDays treated as 0', () => {
    // Select 3 days when only 2.08 available
    const selected = ['2026-02-02', '2026-02-03', '2026-02-04'];
    const rNaN = computeAllStatuses(selected, selected, {}, '2026-02-01', 0, 5, 5, NaN);
    // NaN comparison: -0.92 >= NaN is false → should be overdrawn
    expect(rNaN['2026-02-04']).toBe('selected-overdrawn');
  });

  it('advance days: realistic scenario with startDate today', () => {
    // Simulate user starting Feb 2026, selecting 3 days in Feb
    // Vacation year 2025: Feb has 2.08 days available (credited at start of month)
    // Select 3 days → 3rd day is overdrawn
    const selected = ['2026-02-02', '2026-02-03', '2026-02-04'];
    const r0 = computeAllStatuses(selected, selected, {}, '2026-02-01', 0, 5, 5, 0);
    expect(r0['2026-02-04']).toBe('selected-overdrawn');

    const r5 = computeAllStatuses(selected, selected, {}, '2026-02-01', 0, 5, 5, 5);
    expect(r5['2026-02-04']).toBe('selected-warning');
  });

  it('advance days: changing advance days turns overdrawn into warning', () => {
    // Start Feb 2026, select 5 days in Mar. By Mar: Feb + Mar = 2 months × 2.08 = 4.16 days
    // After 5th day used, balance = 4.16 - 5 = -0.84 → overdrawn with advanceDays=0
    const selected = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06'];
    const allDates = selected;

    const r0 = computeAllStatuses(allDates, selected, {}, '2026-02-01', 0, 5, 5, 0);
    // 5th day: balance = 4.16 - 5 = -0.84 → overdrawn
    expect(r0['2026-03-06']).toBe('selected-overdrawn');

    const r5 = computeAllStatuses(allDates, selected, {}, '2026-02-01', 0, 5, 5, 5);
    // Same scenario but advance=5, so -0.84 >= -5 → warning
    expect(r5['2026-03-06']).toBe('selected-warning');
  });
});

// --- Helper function tests ---

function makeVacationYear(overrides: Partial<VacationYearState> = {}): VacationYearState {
  return {
    earned: 0, extra: 0, used: 0, transferred: 0,
    expired: false, usableEnd: '2026-12-31',
    ...overrides,
  };
}

describe('classifyStaticDates', () => {
  it('marks dates before startDate as before-start', () => {
    const result = classifyStaticDates(
      ['2025-12-31', '2026-01-01'],
      '2026-01-01', {}, new Set()
    );
    expect(result['2025-12-31']).toBe('before-start');
    expect(result['2026-01-01']).toBe('normal');
  });

  it('marks enabled holidays', () => {
    const result = classifyStaticDates(
      ['2026-01-01'],
      '2026-01-01', { '2026-01-01': true }, new Set()
    );
    expect(result['2026-01-01']).toBe('holiday');
  });

  it('marks weekends as weekend', () => {
    // 2026-01-03 = Saturday, 2026-01-04 = Sunday
    const result = classifyStaticDates(
      ['2026-01-03', '2026-01-04'],
      '2026-01-01', {}, new Set()
    );
    expect(result['2026-01-03']).toBe('weekend');
    expect(result['2026-01-04']).toBe('weekend');
  });

  it('marks weekdays as normal', () => {
    // 2026-01-05 = Monday
    const result = classifyStaticDates(
      ['2026-01-05'],
      '2026-01-01', {}, new Set()
    );
    expect(result['2026-01-05']).toBe('normal');
  });

  it('skips selected dates (leaves them out of result)', () => {
    const result = classifyStaticDates(
      ['2026-01-05'],
      '2026-01-01', {}, new Set(['2026-01-05'])
    );
    expect(result['2026-01-05']).toBeUndefined();
  });

  it('holiday takes priority over selected', () => {
    const result = classifyStaticDates(
      ['2026-01-01'],
      '2026-01-01', { '2026-01-01': true }, new Set(['2026-01-01'])
    );
    expect(result['2026-01-01']).toBe('holiday');
  });
});

describe('buildTimelineEvents', () => {
  it('generates 12 earn events for a full vacation year', () => {
    // Employment starts Sep 2025, one vacation year
    const events = buildTimelineEvents(2025, 1, '2025-09-01', '2025-09-01', 5);
    const earnEvents = events.filter(e => e.kind === 'earn');
    expect(earnEvents).toHaveLength(12);
    expect(earnEvents[0].date).toBe('2025-09-01');
    expect(earnEvents[11].date).toBe('2026-08-01');
  });

  it('generates fewer earn events when employment starts mid-year', () => {
    // Employment starts Jan 2026, vacation year 2025 obtain: Sep 2025 → Aug 2026
    // Effective earn start = Jan 2026 → 8 months (Jan-Aug)
    const events = buildTimelineEvents(2025, 1, '2026-01-01', '2026-01-01', 5);
    const earnEvents = events.filter(e => e.kind === 'earn');
    expect(earnEvents).toHaveLength(8);
    expect(earnEvents[0].date).toBe('2026-01-01');
  });

  it('generates extra event when extraDaysMonth falls in obtain period', () => {
    // Vacation year 2025, extra in May (month 5) → May 2026 is within Sep 2025–Aug 2026
    const events = buildTimelineEvents(2025, 1, '2025-09-01', '2025-09-01', 5);
    const extraEvents = events.filter(e => e.kind === 'extra');
    expect(extraEvents).toHaveLength(1);
    expect(extraEvents[0].date).toBe('2026-05-01');
  });

  it('generates expiry event at Jan 1 two years after vacation year start', () => {
    const events = buildTimelineEvents(2025, 1, '2025-09-01', '2025-09-01', 5);
    const expiryEvents = events.filter(e => e.kind === 'expiry');
    expect(expiryEvents).toHaveLength(1);
    expect(expiryEvents[0].date).toBe('2027-01-01');
  });

  it('sorts events by date, then earn/extra before expiry', () => {
    const events = buildTimelineEvents(2025, 2, '2025-09-01', '2025-09-01', 5);
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1];
      const curr = events[i];
      if (prev.date === curr.date) {
        expect(prev.priority).toBeLessThanOrEqual(curr.priority);
      } else {
        expect(prev.date < curr.date).toBe(true);
      }
    }
  });

  it('generates events for multiple vacation years', () => {
    const events = buildTimelineEvents(2025, 2, '2025-09-01', '2025-09-01', 5);
    const earnEvents = events.filter(e => e.kind === 'earn');
    // 12 earn events per year × 2 years = 24
    expect(earnEvents).toHaveLength(24);
    const expiryEvents = events.filter(e => e.kind === 'expiry');
    expect(expiryEvents).toHaveLength(2);
  });
});

describe('applyEvent', () => {
  it('earn event adds 2.08 to earned', () => {
    const years = [makeVacationYear()];
    const event: TimelineEvent = { date: '2025-09-01', priority: 0, yearIndex: 0, kind: 'earn' };
    applyEvent(event, years, 5, 0, 5);
    expect(years[0].earned).toBeCloseTo(2.08);
  });

  it('extra event adds extraDaysCount to extra', () => {
    const years = [makeVacationYear()];
    const event: TimelineEvent = { date: '2026-05-01', priority: 0, yearIndex: 0, kind: 'extra' };
    applyEvent(event, years, 7, 0, 5);
    expect(years[0].extra).toBe(7);
  });

  it('expiry event marks year as expired', () => {
    const years = [makeVacationYear({ earned: 10 })];
    const event: TimelineEvent = { date: '2027-01-01', priority: 1, yearIndex: 0, kind: 'expiry' };
    applyEvent(event, years, 5, 0, 5);
    expect(years[0].expired).toBe(true);
  });

  it('expiry event transfers up to maxTransferDays to next year', () => {
    const years = [makeVacationYear({ earned: 20 }), makeVacationYear({ usableEnd: '2027-12-31' })];
    const event: TimelineEvent = { date: '2027-01-01', priority: 1, yearIndex: 0, kind: 'expiry' };
    applyEvent(event, years, 5, 0, 5);
    expect(years[1].transferred).toBe(5);
  });

  it('expiry event transfers exact balance when less than maxTransferDays', () => {
    const years = [makeVacationYear({ earned: 3 }), makeVacationYear({ usableEnd: '2027-12-31' })];
    const event: TimelineEvent = { date: '2027-01-01', priority: 1, yearIndex: 0, kind: 'expiry' };
    applyEvent(event, years, 5, 0, 5);
    expect(years[1].transferred).toBeCloseTo(3);
  });

  it('expiry event includes initialDays for yearIndex 0', () => {
    const years = [makeVacationYear({ earned: 2 }), makeVacationYear({ usableEnd: '2027-12-31' })];
    const event: TimelineEvent = { date: '2027-01-01', priority: 1, yearIndex: 0, kind: 'expiry' };
    applyEvent(event, years, 5, 10, 5);
    // balance = 2 + 0 + 0 - 0 + 10 = 12, transfer = min(12, 5) = 5
    expect(years[1].transferred).toBe(5);
  });

  it('expiry event does not transfer when balance is zero', () => {
    const years = [makeVacationYear({ earned: 5, used: 5 }), makeVacationYear({ usableEnd: '2027-12-31' })];
    const event: TimelineEvent = { date: '2027-01-01', priority: 1, yearIndex: 0, kind: 'expiry' };
    applyEvent(event, years, 5, 0, 5);
    expect(years[1].transferred).toBe(0);
  });
});

describe('allocateDay', () => {
  it('allocates to earliest year with positive balance', () => {
    const years = [
      makeVacationYear({ earned: 5 }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    allocateDay('2026-06-01', years, 0);
    expect(years[0].used).toBe(1);
    expect(years[1].used).toBe(0);
  });

  it('skips exhausted year and allocates to next', () => {
    const years = [
      makeVacationYear({ earned: 2, used: 2 }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    allocateDay('2026-06-01', years, 0);
    expect(years[0].used).toBe(2);
    expect(years[1].used).toBe(1);
  });

  it('falls back to latest usable year when all exhausted (borrowing)', () => {
    const years = [
      makeVacationYear({ earned: 0 }),
      makeVacationYear({ earned: 0, usableEnd: '2027-12-31' }),
    ];
    allocateDay('2026-06-01', years, 0);
    // Falls back to latest usable year (index 1, since date is within both)
    expect(years[1].used).toBe(1);
  });

  it('respects usableEnd boundary', () => {
    const years = [
      makeVacationYear({ earned: 5, usableEnd: '2026-05-31' }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    // Date is after year 0's usableEnd
    allocateDay('2026-06-01', years, 0);
    expect(years[0].used).toBe(0);
    expect(years[1].used).toBe(1);
  });

  it('includes initialDays when computing balance for first year', () => {
    const years = [
      makeVacationYear({ earned: 0 }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    // earned=0 but initialDays=10 → balance=10 for first year
    allocateDay('2026-06-01', years, 10);
    expect(years[0].used).toBe(1);
    expect(years[1].used).toBe(0);
  });

  it('splits day across years when earliest year has partial balance', () => {
    const years = [
      makeVacationYear({ earned: 0.8 }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    allocateDay('2026-06-01', years, 0);
    expect(years[0].used).toBeCloseTo(0.8);
    expect(years[1].used).toBeCloseTo(0.2);
  });

  it('includes transferred days in balance for splitting', () => {
    const years = [
      makeVacationYear({ earned: 0, transferred: 0.6 }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    allocateDay('2026-06-01', years, 0);
    expect(years[0].used).toBeCloseTo(0.6);
    expect(years[1].used).toBeCloseTo(0.4);
  });
});

describe('computeTotalActiveBalance', () => {
  it('sums balances of non-expired years', () => {
    const years = [
      makeVacationYear({ earned: 10, extra: 5, used: 3 }),
      makeVacationYear({ earned: 4, extra: 0, used: 1, usableEnd: '2027-12-31' }),
    ];
    // year0: 10+5+0-3 = 12, year1: 4+0+0-1 = 3, total = 15
    expect(computeTotalActiveBalance(years, 0)).toBeCloseTo(15);
  });

  it('skips expired years', () => {
    const years = [
      makeVacationYear({ earned: 10, expired: true }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    expect(computeTotalActiveBalance(years, 0)).toBeCloseTo(5);
  });

  it('includes initialDays for first year only', () => {
    const years = [
      makeVacationYear({ earned: 2 }),
      makeVacationYear({ earned: 3, usableEnd: '2027-12-31' }),
    ];
    // year0: 2+0+0-0+7 = 9, year1: 3+0+0-0 = 3, total = 12
    expect(computeTotalActiveBalance(years, 7)).toBeCloseTo(12);
  });

  it('includes transferred days', () => {
    const years = [
      makeVacationYear({ earned: 5, expired: true }),
      makeVacationYear({ earned: 3, transferred: 5, usableEnd: '2027-12-31' }),
    ];
    // Only year1 active: 3+0+5-0 = 8
    expect(computeTotalActiveBalance(years, 0)).toBeCloseTo(8);
  });
});

describe('statusFromBalance', () => {
  it('returns selected-ok for positive balance', () => {
    expect(statusFromBalance(5, 0)).toBe('selected-ok');
  });

  it('returns selected-ok for zero balance', () => {
    expect(statusFromBalance(0, 0)).toBe('selected-ok');
  });

  it('returns selected-warning when negative but within advance days', () => {
    expect(statusFromBalance(-2, 5)).toBe('selected-warning');
  });

  it('returns selected-warning at exact negative advance limit', () => {
    expect(statusFromBalance(-5, 5)).toBe('selected-warning');
  });

  it('returns selected-overdrawn when beyond advance days', () => {
    expect(statusFromBalance(-6, 5)).toBe('selected-overdrawn');
  });

  it('returns selected-overdrawn for any negative when advanceDays is 0', () => {
    expect(statusFromBalance(-0.01, 0)).toBe('selected-overdrawn');
  });

  it('returns selected-overdrawn when advanceDays is NaN', () => {
    // -1 >= -NaN is false → overdrawn
    expect(statusFromBalance(-1, NaN)).toBe('selected-overdrawn');
  });
});
