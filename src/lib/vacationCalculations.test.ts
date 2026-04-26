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
  enumerateExtraPeriods,
} from './vacationCalculations';
import type { VacationYearState, ExtraPoolState, TimelineEvent } from './vacationCalculations';

describe('computeAllStatuses', () => {
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

  it('earnFromSameMonth=false: first selected day in January is overdrawn (no days credited yet)', () => {
    // startDate Jan 1, earnFromSameMonth=false → Jan's 2.08 days only available from Feb 1
    // So on Jan 5 balance = 0 → selecting it means overdrawn immediately
    const selected = ['2026-01-05'];
    const result = computeAllStatuses(
      selected,
      selected,
      {},
      '2026-01-01', 0, 5, 5, 0, 5, false
    );
    expect(result['2026-01-05']).toBe('selected-overdrawn');
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
    const { vacationYears } = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2026-01-01'
    );
    expect(vacationYears).toHaveLength(1);
    expect(vacationYears[0].year).toBe(2025);
    expect(vacationYears[0].earned).toBeCloseTo(10.4); // 5 months × 2.08 (Sep, Oct, Nov, Dec, Jan)
    expect(vacationYears[0].used).toBe(0);
    expect(vacationYears[0].expired).toBe(false);
  });

  it('initial days go to earliest vacation year', () => {
    const { vacationYears } = getVacationYearBalances(
      '2025-09-01', 10, 5, 5, [], {}, '2026-01-01'
    );
    expect(vacationYears[0].balance).toBeCloseTo(10 + 10.4); // 5 months × 2.08
  });

  it('allocates used days to earliest vacation year first', () => {
    // Two vacation years active: 2025 (usable until Dec 2026) and 2026 (usable until Dec 2027)
    // Start Sep 2025, check at Nov 2026 (vacation year 2025 and 2026 both active)
    const selected = ['2026-10-01', '2026-10-02']; // In vacation year 2026 obtain period
    const { vacationYears } = getVacationYearBalances(
      '2025-09-01', 5, 5, 5, selected, {}, '2026-11-01'
    );
    // Should consume from vacation year 2025 first (earliest) — but extras cover it first
    // May 2026 extra (5 days) is active, so first 2 days consumed from extras, vy2025 untouched
    expect(vacationYears[0].used).toBe(0);
    expect(vacationYears[1].used).toBe(0);
  });

  it('splits used days across years when earliest year has partial balance', () => {
    // Start Sep 2025, check at Nov 2026
    // vy2025: 12 months × 2.08 = 24.96 earned (extras in separate pool)
    // May 2025 grant is skipped (natural grant date before start), so Sep-Dec 2025
    // dates all consume from vy2025. May 2026 grant absorbs the Oct 2026 day.
    // Select 24 weekdays in Sep-Dec 2025, then 1 day in Oct 2026.
    const selected: string[] = [];
    let count = 0;
    for (let m = 9; m <= 12 && count < 24; m++) {
      for (let d = 1; d <= 28 && count < 24; d++) {
        const dt = new Date(2025, m - 1, d);
        if (dt.getDay() !== 0 && dt.getDay() !== 6) {
          selected.push(`2025-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
          count++;
        }
      }
    }
    // Add one more day in Oct 2026 (after May 2026 extra grant is active)
    selected.push('2026-10-01');

    const { vacationYears, extraPeriods } = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, selected, {}, '2026-11-01'
    );
    const vy2025 = vacationYears.find(b => b.year === 2025)!;
    const vy2026 = vacationYears.find(b => b.year === 2026)!;
    // May 2025 grant is skipped (before start), so all 24 Sep-Dec 2025 days come from vy2025
    expect(vy2025.used).toBeCloseTo(24);
    // May 2026 grant absorbs the Oct 2026 day
    const ep2026 = extraPeriods.find(ep => ep.startDate === '2026-05-01')!;
    expect(ep2026.used).toBeCloseTo(1);
    expect(vy2026.used).toBeCloseTo(0);
  });

  it('transfer: up to 5 days carry over, excess is lost (extras not in pool)', () => {
    // Vacation year 2025 expires Dec 31, 2026. Check at Jan 2027.
    // vy2025 earns 12×2.08=24.96 (extras NOT in ferieår pool anymore)
    const { vacationYears } = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2027-01-01'
    );
    const vy2025 = vacationYears.find(b => b.year === 2025)!;
    const vy2026 = vacationYears.find(b => b.year === 2026)!;
    expect(vy2025.expired).toBe(true);
    expect(vy2025.earned).toBeCloseTo(24.96);
    expect(vy2025.lost).toBeCloseTo(24.96 - 5); // 19.96 lost
    expect(vy2026.transferred).toBe(5); // max 5 transferred
  });

  it('transfer: no loss when remaining ≤ 5', () => {
    // Use extraDaysCount=0 so all days draw directly from vy2025 (no extras pool interference).
    // Vacation year 2025: 24.96 earned, use 22 → 2.96 left, all transferable (≤ 5)
    const selected: string[] = [];
    let count = 0;
    for (let m = 9; m <= 12 && count < 22; m++) {
      for (let d = 1; d <= 28 && count < 22; d++) {
        const dt = new Date(2025, m - 1, d);
        if (dt.getDay() !== 0 && dt.getDay() !== 6) {
          selected.push(`2025-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
          count++;
        }
      }
    }
    const { vacationYears } = getVacationYearBalances(
      '2025-09-01', 0, 5, 0, selected, {}, '2027-01-01'
    );
    const vy2025 = vacationYears.find(b => b.year === 2025)!;
    // 24.96 - 22 = 2.96 remaining, all transferable
    expect(vy2025.balance).toBeCloseTo(2.96);
    expect(vy2025.lost).toBe(0);
    const vy2026 = vacationYears.find(b => b.year === 2026)!;
    expect(vy2026.transferred).toBeCloseTo(2.96);
  });

  it('extra periods: grant and expiry dates correct', () => {
    // Extra in May (month 5). Grant 2026-05-01, expires 2027-05-01.
    const { extraPeriods } = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2026-06-01'
    );
    const ep2026 = extraPeriods.find(ep => ep.startDate === '2026-05-01');
    expect(ep2026).toBeDefined();
    expect(ep2026!.expiryDate).toBe('2027-05-01');
    expect(ep2026!.granted).toBe(5);
    expect(ep2026!.expired).toBe(false);
  });

  it('extras consumed before ferieår days', () => {
    // Select a day in May 2026 — extras (granted May 1 2026) should absorb it
    const { vacationYears, extraPeriods } = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, ['2026-05-05'], {}, '2026-06-01'
    );
    const ep = extraPeriods.find(ep => ep.startDate === '2026-05-01')!;
    expect(ep.used).toBeCloseTo(1);
    // vy2025 untouched
    expect(vacationYears.find(b => b.year === 2025)!.used).toBe(0);
  });

  it('extras do not participate in ferieår transfer', () => {
    // At Dec 31 with unused extras — transfer should only reflect earned days
    const { vacationYears, extraPeriods } = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2027-01-01'
    );
    // May 2026 extra period expires May 2027, so still active at Jan 2027
    const ep2026 = extraPeriods.find(ep => ep.startDate === '2026-05-01')!;
    expect(ep2026.balance).toBe(5); // untouched

    // vy2025 transferred reflects only earned days (max 5 from 24.96 earned)
    const vy2026 = vacationYears.find(b => b.year === 2026)!;
    expect(vy2026.transferred).toBe(5);
  });

  it('extras outlive their ferieår — still usable after vy expires', () => {
    // May 2025 grant (startDate=2024-09-01): expires May 2026
    // vy2024 expires Dec 31 2025 — but the May 2025 extra is still usable until Apr 30 2026
    const { extraPeriods } = getVacationYearBalances(
      '2024-09-01', 0, 5, 5, ['2026-02-02'], {}, '2026-03-01'
    );
    const ep2025 = extraPeriods.find(ep => ep.startDate === '2025-05-01')!;
    expect(ep2025).toBeDefined();
    expect(ep2025.used).toBeCloseTo(1); // Feb 2026 day consumed from May 2025 grant
    expect(ep2025.expired).toBe(false);
  });

  it('extras expire on grant anniversary (expiryDate exclusive)', () => {
    // May 2026 grant expires May 1 2027 (exclusive) — last usable is Apr 30 2027
    const { extraPeriods: periodsBefore } = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, ['2027-04-30'], {}, '2027-05-01'
    );
    const epBefore = periodsBefore.find(ep => ep.startDate === '2026-05-01')!;
    expect(epBefore.used).toBeCloseTo(1); // Apr 30 usable

    const { extraPeriods: periodsOn } = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, ['2027-05-01'], {}, '2027-06-01'
    );
    // May 1 2027 is the new grant date — consumed from the 2027 period, not the 2026 one
    const ep2026 = periodsOn.find(ep => ep.startDate === '2026-05-01')!;
    const ep2027 = periodsOn.find(ep => ep.startDate === '2027-05-01')!;
    expect(ep2026.used).toBe(0);     // expired before May 1
    expect(ep2027.used).toBeCloseTo(1); // new grant covers May 1
  });

  it('earnFromSameMonth=false: extra grant period shifts one month', () => {
    const { extraPeriods } = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2026-07-01', 5, false
    );
    // Natural grant May 2026 → startDate shifts to Jun 2026 when !earnFromSameMonth
    const ep = extraPeriods.find(ep => ep.startDate === '2026-06-01');
    expect(ep).toBeDefined();
    expect(ep!.expiryDate).toBe('2027-05-01'); // expiry still anchored to natural grant
  });

  it('extras not emitted when extraDaysCount is 0', () => {
    const { extraPeriods } = getVacationYearBalances(
      '2025-09-01', 0, 5, 0, [], {}, '2026-06-01'
    );
    expect(extraPeriods).toHaveLength(0);
  });

  it('earnFromSameMonth=false delays earn by one month', () => {
    // Start Sep 2025, check at Jan 2026
    // earnFromSameMonth=true: Sep, Oct, Nov, Dec, Jan = 5 months = 10.4
    // earnFromSameMonth=false: only Sep-Dec credited by Jan 1 (Jan's days available from Feb 1) = 4 months = 8.32
    const { vacationYears: balancesTrue } = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2026-01-01', 5, true
    );
    const { vacationYears: balancesFalse } = getVacationYearBalances(
      '2025-09-01', 0, 5, 5, [], {}, '2026-01-01', 5, false
    );
    expect(balancesTrue[0].earned).toBeCloseTo(10.4);
    expect(balancesFalse[0].earned).toBeCloseTo(8.32); // 4 months × 2.08
  });
});

describe('enumerateExtraPeriods', () => {
  it('returns empty when extraDaysCount is 0', () => {
    expect(enumerateExtraPeriods('2025-09-01', '2026-12-31', 5, 0)).toHaveLength(0);
  });

  it('generates correct start and expiry dates', () => {
    const periods = enumerateExtraPeriods('2025-09-01', '2026-12-31', 5, 5);
    const ep = periods.find(ep => ep.startDate === '2026-05-01');
    expect(ep).toBeDefined();
    expect(ep!.expiryDate).toBe('2027-05-01');
    expect(ep!.granted).toBe(5);
  });

  it('skips periods entirely before employment start', () => {
    // startDate 2026-09-01, extraDaysMonth=5 → May 2025 grant (natural date < start) is skipped,
    // May 2026 grant (natural date Sep 2026) is included
    const periods = enumerateExtraPeriods('2026-09-01', '2027-12-31', 5, 5);
    expect(periods.every(ep => ep.expiryDate > '2026-09-01')).toBe(true);
  });

  it('shifts startDate by one month when earnFromSameMonth=false', () => {
    const periods = enumerateExtraPeriods('2025-09-01', '2026-12-31', 5, 5, false);
    const ep = periods.find(ep => ep.expiryDate === '2027-05-01');
    expect(ep).toBeDefined();
    expect(ep!.startDate).toBe('2026-06-01');
  });

  it('marks period as expired when atDate >= expiryDate', () => {
    const periods = enumerateExtraPeriods('2025-09-01', '2027-06-01', 5, 5);
    const ep2026 = periods.find(ep => ep.expiryDate === '2027-05-01')!;
    expect(ep2026.expired).toBe(true); // atDate 2027-06-01 >= 2027-05-01
  });
});

// --- Helper function tests ---

function makeVacationYear(overrides: Partial<VacationYearState> = {}): VacationYearState {
  return {
    earned: 0, used: 0, transferred: 0,
    expired: false, usableEnd: '2026-12-31',
    ...overrides,
  };
}

function makeExtraPool(overrides: Partial<ExtraPoolState> = {}): ExtraPoolState {
  return {
    startDate: '2026-05-01',
    expiryDate: '2027-05-01',
    granted: 0,
    used: 0,
    expired: false,
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
    const events = buildTimelineEvents(2025, 1, '2025-09-01');
    const earnEvents = events.filter(e => e.kind === 'earn');
    expect(earnEvents).toHaveLength(12);
    expect(earnEvents[0].date).toBe('2025-09-01');
    expect(earnEvents[11].date).toBe('2026-08-01');
  });

  it('generates fewer earn events when employment starts mid-year', () => {
    // Employment starts Jan 2026, vacation year 2025 obtain: Sep 2025 → Aug 2026
    // Effective earn start = Jan 2026 → 8 months (Jan-Aug)
    const events = buildTimelineEvents(2025, 1, '2026-01-01');
    const earnEvents = events.filter(e => e.kind === 'earn');
    expect(earnEvents).toHaveLength(8);
    expect(earnEvents[0].date).toBe('2026-01-01');
  });

  it('generates extra-grant and extra-expiry events from extraPeriods', () => {
    const extraPeriods: ExtraPoolState[] = [makeExtraPool({ startDate: '2026-05-01', expiryDate: '2027-05-01' })];
    const events = buildTimelineEvents(2025, 1, '2025-09-01', true, extraPeriods);
    const grantEvents = events.filter(e => e.kind === 'extra-grant');
    const expiryEvents = events.filter(e => e.kind === 'extra-expiry');
    expect(grantEvents).toHaveLength(1);
    expect(grantEvents[0].date).toBe('2026-05-01');
    expect(expiryEvents).toHaveLength(1);
    expect(expiryEvents[0].date).toBe('2027-05-01');
  });

  it('generates expiry event at Jan 1 two years after vacation year start', () => {
    const events = buildTimelineEvents(2025, 1, '2025-09-01');
    const expiryEvents = events.filter(e => e.kind === 'expiry');
    expect(expiryEvents).toHaveLength(1);
    expect(expiryEvents[0].date).toBe('2027-01-01');
  });

  it('sorts events by date, then earn/extra-grant before expiry', () => {
    const extraPeriods: ExtraPoolState[] = [makeExtraPool()];
    const events = buildTimelineEvents(2025, 2, '2025-09-01', true, extraPeriods);
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
    const events = buildTimelineEvents(2025, 2, '2025-09-01');
    const earnEvents = events.filter(e => e.kind === 'earn');
    // 12 earn events per year × 2 years = 24
    expect(earnEvents).toHaveLength(24);
    const expiryEvents = events.filter(e => e.kind === 'expiry');
    expect(expiryEvents).toHaveLength(2);
  });

  it('no extra events when extraPeriods is empty', () => {
    const events = buildTimelineEvents(2025, 1, '2025-09-01');
    expect(events.filter(e => e.kind === 'extra-grant' || e.kind === 'extra-expiry')).toHaveLength(0);
  });
});

describe('applyEvent', () => {
  it('earn event adds 2.08 to earned', () => {
    const years = [makeVacationYear()];
    const event: TimelineEvent = { date: '2025-09-01', priority: 0, yearIndex: 0, kind: 'earn' };
    applyEvent(event, years, [], 5, 0, 5);
    expect(years[0].earned).toBeCloseTo(2.08);
  });

  it('extra-grant event sets granted on the extra pool', () => {
    const pools = [makeExtraPool()];
    const event: TimelineEvent = { date: '2026-05-01', priority: 0, extraIndex: 0, kind: 'extra-grant' };
    applyEvent(event, [], pools, 7, 0, 5);
    expect(pools[0].granted).toBe(7);
  });

  it('extra-expiry event marks the extra pool as expired', () => {
    const pools = [makeExtraPool({ granted: 5 })];
    const event: TimelineEvent = { date: '2027-05-01', priority: 1, extraIndex: 0, kind: 'extra-expiry' };
    applyEvent(event, [], pools, 5, 0, 5);
    expect(pools[0].expired).toBe(true);
  });

  it('expiry event marks year as expired', () => {
    const years = [makeVacationYear({ earned: 10 })];
    const event: TimelineEvent = { date: '2027-01-01', priority: 1, yearIndex: 0, kind: 'expiry' };
    applyEvent(event, years, [], 5, 0, 5);
    expect(years[0].expired).toBe(true);
  });

  it('expiry event transfers up to maxTransferDays to next year', () => {
    const years = [makeVacationYear({ earned: 20 }), makeVacationYear({ usableEnd: '2027-12-31' })];
    const event: TimelineEvent = { date: '2027-01-01', priority: 1, yearIndex: 0, kind: 'expiry' };
    applyEvent(event, years, [], 5, 0, 5);
    expect(years[1].transferred).toBe(5);
  });

  it('expiry event transfers exact balance when less than maxTransferDays', () => {
    const years = [makeVacationYear({ earned: 3 }), makeVacationYear({ usableEnd: '2027-12-31' })];
    const event: TimelineEvent = { date: '2027-01-01', priority: 1, yearIndex: 0, kind: 'expiry' };
    applyEvent(event, years, [], 5, 0, 5);
    expect(years[1].transferred).toBeCloseTo(3);
  });

  it('expiry event includes initialDays for yearIndex 0', () => {
    const years = [makeVacationYear({ earned: 2 }), makeVacationYear({ usableEnd: '2027-12-31' })];
    const event: TimelineEvent = { date: '2027-01-01', priority: 1, yearIndex: 0, kind: 'expiry' };
    applyEvent(event, years, [], 5, 10, 5);
    // balance = 2 + 0 - 0 + 10 = 12, transfer = min(12, 5) = 5
    expect(years[1].transferred).toBe(5);
  });

  it('expiry event does not transfer when balance is zero', () => {
    const years = [makeVacationYear({ earned: 5, used: 5 }), makeVacationYear({ usableEnd: '2027-12-31' })];
    const event: TimelineEvent = { date: '2027-01-01', priority: 1, yearIndex: 0, kind: 'expiry' };
    applyEvent(event, years, [], 5, 0, 5);
    expect(years[1].transferred).toBe(0);
  });

  it('expiry event does not include extra pool balance in transfer', () => {
    // Extras are independent — ferieår expiry should only transfer earned days
    const years = [makeVacationYear({ earned: 3 }), makeVacationYear({ usableEnd: '2027-12-31' })];
    const pools = [makeExtraPool({ granted: 5 })]; // 5 extra days still active
    const event: TimelineEvent = { date: '2027-01-01', priority: 1, yearIndex: 0, kind: 'expiry' };
    applyEvent(event, years, pools, 5, 0, 5);
    // Only 3 earned days transfer, not 3+5
    expect(years[1].transferred).toBeCloseTo(3);
  });
});

describe('allocateDay', () => {
  it('consumes from extra pool before ferieår (extras first)', () => {
    const years = [makeVacationYear({ earned: 5 })];
    const pools = [makeExtraPool({ granted: 3 })];
    allocateDay('2026-06-01', years, pools, 0);
    expect(pools[0].used).toBe(1);
    expect(years[0].used).toBe(0);
  });

  it('falls through to ferieår when extra pool is exhausted', () => {
    const years = [makeVacationYear({ earned: 5 })];
    const pools = [makeExtraPool({ granted: 0 })]; // pool empty (grant not yet fired)
    allocateDay('2026-06-01', years, pools, 0);
    expect(pools[0].used).toBe(0);
    expect(years[0].used).toBe(1);
  });

  it('skips expired extra pool and uses ferieår', () => {
    const years = [makeVacationYear({ earned: 5 })];
    const pools = [makeExtraPool({ granted: 5, expired: true })];
    allocateDay('2026-06-01', years, pools, 0);
    expect(pools[0].used).toBe(0);
    expect(years[0].used).toBe(1);
  });

  it('does not use extra pool when date is outside period range', () => {
    const years = [makeVacationYear({ earned: 5 })];
    // Pool runs May 2026 → May 2027, but date is before that
    const pools = [makeExtraPool({ startDate: '2026-05-01', expiryDate: '2027-05-01', granted: 5 })];
    allocateDay('2026-04-01', years, pools, 0);
    expect(pools[0].used).toBe(0);
    expect(years[0].used).toBe(1);
  });

  it('allocates to earliest ferieår year with positive balance when no extras', () => {
    const years = [
      makeVacationYear({ earned: 5 }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    allocateDay('2026-06-01', years, [], 0);
    expect(years[0].used).toBe(1);
    expect(years[1].used).toBe(0);
  });

  it('skips exhausted year and allocates to next', () => {
    const years = [
      makeVacationYear({ earned: 2, used: 2 }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    allocateDay('2026-06-01', years, [], 0);
    expect(years[0].used).toBe(2);
    expect(years[1].used).toBe(1);
  });

  it('falls back to latest usable year when all exhausted (borrowing)', () => {
    const years = [
      makeVacationYear({ earned: 0 }),
      makeVacationYear({ earned: 0, usableEnd: '2027-12-31' }),
    ];
    allocateDay('2026-06-01', years, [], 0);
    // Falls back to latest usable year (index 1, since date is within both)
    expect(years[1].used).toBe(1);
  });

  it('respects usableEnd boundary', () => {
    const years = [
      makeVacationYear({ earned: 5, usableEnd: '2026-05-31' }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    // Date is after year 0's usableEnd
    allocateDay('2026-06-01', years, [], 0);
    expect(years[0].used).toBe(0);
    expect(years[1].used).toBe(1);
  });

  it('includes initialDays when computing balance for first year', () => {
    const years = [
      makeVacationYear({ earned: 0 }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    // earned=0 but initialDays=10 → balance=10 for first year
    allocateDay('2026-06-01', years, [], 10);
    expect(years[0].used).toBe(1);
    expect(years[1].used).toBe(0);
  });

  it('splits day across years when earliest year has partial balance', () => {
    const years = [
      makeVacationYear({ earned: 0.8 }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    allocateDay('2026-06-01', years, [], 0);
    expect(years[0].used).toBeCloseTo(0.8);
    expect(years[1].used).toBeCloseTo(0.2);
  });

  it('includes transferred days in balance for splitting', () => {
    const years = [
      makeVacationYear({ earned: 0, transferred: 0.6 }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    allocateDay('2026-06-01', years, [], 0);
    expect(years[0].used).toBeCloseTo(0.6);
    expect(years[1].used).toBeCloseTo(0.4);
  });

  it('extras not borrowed against (borrow goes to ferieår)', () => {
    // All ferieår exhausted, extra pool also exhausted — borrow must go to ferieår, not extras
    const years = [makeVacationYear({ earned: 0, usableEnd: '2027-12-31' })];
    const pools = [makeExtraPool({ granted: 0 })]; // empty pool
    allocateDay('2026-06-01', years, pools, 0);
    expect(years[0].used).toBe(1);
    expect(pools[0].used).toBe(0);
  });
});

describe('computeTotalActiveBalance', () => {
  it('sums balances of non-expired ferieår years', () => {
    const years = [
      makeVacationYear({ earned: 10, used: 3 }),
      makeVacationYear({ earned: 4, used: 1, usableEnd: '2027-12-31' }),
    ];
    // year0: 10+0-3 = 7, year1: 4+0-1 = 3, total = 10
    expect(computeTotalActiveBalance(years, [], 0)).toBeCloseTo(10);
  });

  it('includes active extra pools in total', () => {
    const years = [makeVacationYear({ earned: 5 })];
    const pools = [makeExtraPool({ granted: 3, used: 1 })];
    // years: 5, extras: 3-1=2, total=7
    expect(computeTotalActiveBalance(years, pools, 0)).toBeCloseTo(7);
  });

  it('skips expired ferieår years', () => {
    const years = [
      makeVacationYear({ earned: 10, expired: true }),
      makeVacationYear({ earned: 5, usableEnd: '2027-12-31' }),
    ];
    expect(computeTotalActiveBalance(years, [], 0)).toBeCloseTo(5);
  });

  it('skips expired extra pools', () => {
    const years = [makeVacationYear({ earned: 5 })];
    const pools = [makeExtraPool({ granted: 3, expired: true })];
    expect(computeTotalActiveBalance(years, pools, 0)).toBeCloseTo(5);
  });

  it('includes initialDays for first year only', () => {
    const years = [
      makeVacationYear({ earned: 2 }),
      makeVacationYear({ earned: 3, usableEnd: '2027-12-31' }),
    ];
    // year0: 2+0+0-0+7 = 9, year1: 3+0+0-0 = 3, total = 12
    expect(computeTotalActiveBalance(years, [], 7)).toBeCloseTo(12);
  });

  it('includes transferred days', () => {
    const years = [
      makeVacationYear({ earned: 5, expired: true }),
      makeVacationYear({ earned: 3, transferred: 5, usableEnd: '2027-12-31' }),
    ];
    // Only year1 active: 3+0+5-0 = 8
    expect(computeTotalActiveBalance(years, [], 0)).toBeCloseTo(8);
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
