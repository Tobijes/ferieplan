import {
  parseISO,
  differenceInMonths,
  isWeekend,
  startOfMonth,
  addMonths,
  format,
} from 'date-fns';
import type { DayStatus, VacationYearBalance, ExtraDayPeriod, VacationYearBalancesResult } from '@/types';

/** Epsilon for floating-point balance comparisons */
const EPS = 1e-9;

// --- Per-vacation-year balance system ---

/**
 * Get the vacation year start year for a given date.
 * Vacation year N runs Sep 1 Year N → Aug 31 Year N+1.
 * A date in Jan-Aug belongs to vacation year (year-1), Sep-Dec belongs to vacation year (year).
 */
export function getVacationYearForDate(dateStr: string): number {
  const d = parseISO(dateStr);
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  return month >= 8 ? year : year - 1; // Aug=7 → prev year, Sep=8 → this year
}

/**
 * Obtain period for vacation year N: Sep 1 Year N → Aug 31 Year N+1
 */
function obtainPeriod(vacationYear: number): { start: string; end: string } {
  return {
    start: `${vacationYear}-09-01`,
    end: `${vacationYear + 1}-09-01`, // Use Sep 1 (exclusive) for month counting
  };
}

/**
 * Usable period for vacation year N: Sep 1 Year N → Dec 31 Year N+1
 */
function usablePeriodEnd(vacationYear: number): string {
  return `${vacationYear + 1}-12-31`;
}


/**
 * Compute earned days for a specific vacation year at a given date.
 * Days are credited at the start of each month (usable from day 1 of the month).
 * If employment starts mid-month, the full month's days are still credited.
 */
function earnedInVacationYear(
  vacationYear: number,
  atDate: string,
  employmentStartDate: string,
  earnFromSameMonth: boolean = true
): number {
  const obtain = obtainPeriod(vacationYear);

  // Round employment start to beginning of month (if you start mid-month, you still get that month's days)
  const employmentStartMonthStart = format(startOfMonth(parseISO(employmentStartDate)), 'yyyy-MM-dd');

  // Effective start is the later of obtain period start and employment start month
  const effectiveStart = obtain.start > employmentStartMonthStart ? obtain.start : employmentStartMonthStart;

  // Calculate earn-end boundary based on earnFromSameMonth setting
  const atDateParsed = parseISO(atDate);
  const earnEndDate = earnFromSameMonth
    ? addMonths(startOfMonth(atDateParsed), 1)
    : startOfMonth(atDateParsed);
  const nextMonthStart = format(earnEndDate, 'yyyy-MM-dd');

  // Effective end is the earlier of obtain period end and earn-end boundary
  const effectiveEnd = obtain.end < nextMonthStart ? obtain.end : nextMonthStart;

  if (effectiveStart > effectiveEnd) return 0;

  const start = parseISO(effectiveStart);
  const end = parseISO(effectiveEnd);
  const months = differenceInMonths(end, start);
  if (months <= 0) return 0;
  return months * 2.08;
}

/**
 * Enumerate all extra-day grant periods overlapping the given date window.
 * Each grant is tied to a calendar year and runs for approximately one year.
 * The grant date is 1st of extraDaysMonth; expiry (exclusive) is 1st of the same month next year.
 * When earnFromSameMonth is false, the first usable date shifts one month forward.
 */
export function enumerateExtraPeriods(
  startDate: string,
  atDate: string,
  extraDaysMonth: number,
  extraDaysCount: number,
  earnFromSameMonth: boolean = true
): ExtraDayPeriod[] {
  if (extraDaysCount <= 0) return [];

  const periods: ExtraDayPeriod[] = [];
  const startYear = parseISO(startDate).getFullYear();
  const atYear = parseISO(atDate).getFullYear();
  const mm = String(extraDaysMonth).padStart(2, '0');

  for (let y = startYear; y <= atYear + 1; y++) {
    const naturalGrantDate = `${y}-${mm}-01`;
    const expiryDate = `${y + 1}-${mm}-01`; // exclusive upper bound

    if (naturalGrantDate < startDate) continue;

    // Skip periods entirely before employment
    if (expiryDate <= startDate) continue;

    // First-usable date respects earnFromSameMonth
    let periodStart: string;
    if (earnFromSameMonth) {
      periodStart = naturalGrantDate;
    } else {
      // Shift one month forward
      const shifted = addMonths(parseISO(naturalGrantDate), 1);
      periodStart = format(shifted, 'yyyy-MM-dd');
    }

    // Clamp to employment start
    const effectiveStart = periodStart < startDate ? startDate : periodStart;

    // Only emit if the period overlaps our window (effectiveStart must be before expiryDate)
    if (effectiveStart >= expiryDate) continue;

    periods.push({
      startDate: effectiveStart,
      expiryDate,
      granted: extraDaysCount,
      used: 0,
      balance: extraDaysCount,
      expired: atDate >= expiryDate,
    });
  }

  return periods;
}

/**
 * Compute per-vacation-year balances at a given date.
 * Allocates used days to the earliest available (non-expired) vacation year first,
 * with extra-day periods consumed before ferieår days.
 * Returns both vacation year balances and extra-day period balances.
 */
export function getVacationYearBalances(
  startDate: string,
  initialDays: number,
  extraDaysMonth: number,
  extraDaysCount: number,
  selectedDates: string[],
  enabledHolidays: Record<string, boolean>,
  atDate: string,
  maxTransferDays: number = 5,
  earnFromSameMonth: boolean = true
): VacationYearBalancesResult {
  // Determine range of vacation years to consider
  const startVacationYear = getVacationYearForDate(startDate);
  const endVacationYear = getVacationYearForDate(atDate);
  const vacationYearNums: number[] = [];
  for (let y = startVacationYear; y <= endVacationYear; y++) {
    vacationYearNums.push(y);
  }

  // Build balance objects (no extra field)
  const vacationYears: VacationYearBalance[] = vacationYearNums.map((year) => {
    const earned = earnedInVacationYear(year, atDate, startDate, earnFromSameMonth);
    const expEnd = usablePeriodEnd(year);
    const expired = atDate > expEnd;

    return {
      year,
      earned,
      used: 0,
      transferred: 0,
      balance: earned,
      lost: 0,
      expired,
    };
  });

  // Add initial days to the earliest vacation year
  if (vacationYears.length > 0) {
    vacationYears[0].balance += initialDays;
  }

  // Build extra-day periods
  const extraPeriods = enumerateExtraPeriods(startDate, atDate, extraDaysMonth, extraDaysCount, earnFromSameMonth);

  // Step 1: Allocate used days — extras first, then ferieår waterfall
  const usedDates = [...selectedDates]
    .filter((d) => !enabledHolidays[d] && d <= atDate)
    .sort();

  for (const d of usedDates) {
    let remaining = 1;

    // Extras first: consume from each non-expired extra period in chronological order
    for (const ep of extraPeriods) {
      if (remaining <= EPS) break;
      if (d >= ep.startDate && d < ep.expiryDate) {
        const available = ep.granted - ep.used;
        if (available > EPS) {
          const consume = Math.min(available, remaining);
          ep.used += consume;
          remaining -= consume;
        }
      }
    }

    if (remaining <= EPS) continue;

    // Ferieår pass 1: consume from earliest year with positive available balance
    for (let i = 0; i < vacationYears.length; i++) {
      if (remaining <= EPS) break;
      const b = vacationYears[i];
      const usableEnd = usablePeriodEnd(b.year);
      if (d <= usableEnd) {
        const available = b.earned + b.transferred - b.used + (i === 0 ? initialDays : 0);
        if (available > EPS) {
          const consume = Math.min(available, remaining);
          b.used += consume;
          remaining -= consume;
        }
      }
    }

    // Ferieår pass 2: borrow from latest usable year
    if (remaining > EPS) {
      for (let i = vacationYears.length - 1; i >= 0; i--) {
        const usableEnd = usablePeriodEnd(vacationYears[i].year);
        if (d <= usableEnd) {
          vacationYears[i].used += remaining;
          break;
        }
      }
    }
  }

  // Step 2: Recalculate ferieår balances after usage
  for (let i = 0; i < vacationYears.length; i++) {
    const b = vacationYears[i];
    b.balance = b.earned + b.transferred - b.used;
    if (i === 0) b.balance += initialDays;
    if (Math.abs(b.balance) < EPS) b.balance = 0;
  }

  // Step 3: Recalculate extra period balances
  for (const ep of extraPeriods) {
    ep.balance = ep.granted - ep.used;
    if (Math.abs(ep.balance) < EPS) ep.balance = 0;
  }

  // Step 4: Process transfers from expired vacation years (ferieår only — extras don't transfer)
  for (let i = 0; i < vacationYears.length - 1; i++) {
    const b = vacationYears[i];
    if (b.expired && b.balance > 0) {
      const transferable = Math.min(b.balance, maxTransferDays);
      b.lost = Math.max(0, b.balance - maxTransferDays);
      vacationYears[i + 1].transferred = transferable;
      vacationYears[i + 1].balance += transferable;
    }
  }

  return { vacationYears, extraPeriods };
}

// --- Status computation helpers ---

export interface VacationYearState {
  earned: number;
  used: number;
  transferred: number;
  expired: boolean;
  usableEnd: string;
}

export interface ExtraPoolState {
  startDate: string;
  expiryDate: string;
  granted: number;  // 0 before the grant event fires
  used: number;
  expired: boolean;
}

export type TimelineEvent =
  | { date: string; priority: number; yearIndex: number; kind: 'earn' | 'expiry' }
  | { date: string; priority: number; extraIndex: number; kind: 'extra-grant' | 'extra-expiry' };

/**
 * Classify dates that don't require balance computation:
 * before-start, holidays, weekends, and normal weekdays.
 * Selected dates are skipped (handled later by balance logic).
 */
export function classifyStaticDates(
  dates: string[],
  startDate: string,
  enabledHolidays: Record<string, boolean>,
  selectedSet: Set<string>
): Record<string, DayStatus> {
  const result: Record<string, DayStatus> = {};
  for (const dateStr of dates) {
    if (dateStr < startDate) {
      result[dateStr] = 'before-start';
    } else if (enabledHolidays[dateStr]) {
      result[dateStr] = 'holiday';
    } else if (!selectedSet.has(dateStr)) {
      result[dateStr] = isWeekend(parseISO(dateStr)) ? 'weekend' : 'normal';
    }
  }
  return result;
}

/**
 * Build a sorted timeline of earn, extra-grant, extra-expiry, and expiry events.
 */
export function buildTimelineEvents(
  firstVacationYear: number,
  vacationYearCount: number,
  employmentMonthStart: string,
  earnFromSameMonth: boolean = true,
  extraPeriods: ExtraPoolState[] = []
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (let i = 0; i < vacationYearCount; i++) {
    const year = firstVacationYear + i;
    const obtainStart = `${year}-09-01`;
    const obtainEndStr = `${year + 1}-09-01`;

    // Earn events: one per month-start in obtain period, after employment start
    const effectiveEarnStart = obtainStart > employmentMonthStart
      ? obtainStart : employmentMonthStart;
    const effectiveEarnStartDate = parseISO(effectiveEarnStart);
    const obtainEndDate = parseISO(obtainEndStr);
    const monthCount = differenceInMonths(obtainEndDate, effectiveEarnStartDate);
    for (let m = 0; m < monthCount; m++) {
      const earnDate = addMonths(effectiveEarnStartDate, earnFromSameMonth ? m : m + 1);
      events.push({
        date: format(earnDate, 'yyyy-MM-dd'),
        priority: 0, yearIndex: i, kind: 'earn',
      });
    }

    // Expiry event: vacation year expires after Dec 31 of year+1
    events.push({ date: `${year + 2}-01-01`, priority: 1, yearIndex: i, kind: 'expiry' });
  }

  // Extra-day grant and expiry events (independent of ferieår)
  for (let i = 0; i < extraPeriods.length; i++) {
    const ep = extraPeriods[i];
    events.push({ date: ep.startDate, priority: 0, extraIndex: i, kind: 'extra-grant' });
    events.push({ date: ep.expiryDate, priority: 1, extraIndex: i, kind: 'extra-expiry' });
  }

  // Sort by (date, priority) so earn/extra-grant fire before expiry at the same date
  events.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    return cmp !== 0 ? cmp : a.priority - b.priority;
  });

  return events;
}

/**
 * Apply a single timeline event to the vacation year state or extra pool state.
 */
export function applyEvent(
  event: TimelineEvent,
  vacationYears: VacationYearState[],
  extraPools: ExtraPoolState[],
  extraDaysCount: number,
  initialDays: number,
  maxTransferDays: number
): void {
  switch (event.kind) {
    case 'earn': {
      vacationYears[event.yearIndex].earned += 2.08;
      break;
    }
    case 'expiry': {
      const target = vacationYears[event.yearIndex];
      const balance = target.earned + target.transferred - target.used
        + (event.yearIndex === 0 ? initialDays : 0);
      target.expired = true;
      if (balance > 0 && event.yearIndex + 1 < vacationYears.length) {
        vacationYears[event.yearIndex + 1].transferred = Math.min(balance, maxTransferDays);
      }
      break;
    }
    case 'extra-grant': {
      extraPools[event.extraIndex].granted = extraDaysCount;
      break;
    }
    case 'extra-expiry': {
      extraPools[event.extraIndex].expired = true;
      break;
    }
  }
}

/**
 * Allocate 1 used day across extra pools (first) and vacation years (waterfall).
 * Consumes from the earliest usable extra pool first, then ferieår waterfall.
 * Falls back to the latest usable ferieår year for borrowing (extras stay non-borrowable).
 */
export function allocateDay(
  dateStr: string,
  vacationYears: VacationYearState[],
  extraPools: ExtraPoolState[],
  initialDays: number
): void {
  let remaining = 1;

  // Pre-pass: extras first — consume from non-expired periods covering this date
  for (const ep of extraPools) {
    if (remaining <= EPS) break;
    if (!ep.expired && dateStr >= ep.startDate && dateStr < ep.expiryDate) {
      const available = ep.granted - ep.used;
      if (available > EPS) {
        const consume = Math.min(available, remaining);
        ep.used += consume;
        remaining -= consume;
      }
    }
  }

  if (remaining <= EPS) return;

  // Pass 1: consume from earliest ferieår years with positive balance
  for (let i = 0; i < vacationYears.length && remaining > EPS; i++) {
    const vy = vacationYears[i];
    if (dateStr <= vy.usableEnd) {
      const balance = vy.earned + vy.transferred - vy.used
        + (i === 0 ? initialDays : 0);
      if (balance > EPS) {
        const consume = Math.min(balance, remaining);
        vy.used += consume;
        remaining -= consume;
      }
    }
  }

  // Pass 2: if remaining, all active years exhausted — borrow from latest usable year
  if (remaining > EPS) {
    for (let i = vacationYears.length - 1; i >= 0; i--) {
      if (dateStr <= vacationYears[i].usableEnd) {
        vacationYears[i].used += remaining;
        return;
      }
    }
  }
}

/**
 * Sum balances across all non-expired vacation years and non-expired extra pools.
 */
export function computeTotalActiveBalance(
  vacationYears: VacationYearState[],
  extraPools: ExtraPoolState[],
  initialDays: number
): number {
  let total = 0;
  for (let i = 0; i < vacationYears.length; i++) {
    const vy = vacationYears[i];
    if (!vy.expired) {
      total += vy.earned + vy.transferred - vy.used
        + (i === 0 ? initialDays : 0);
    }
  }
  for (const ep of extraPools) {
    if (!ep.expired) {
      total += ep.granted - ep.used;
    }
  }
  return total;
}

/**
 * Map a balance value to a day status.
 */
export function statusFromBalance(balance: number, advanceDays: number): DayStatus {
  if (balance >= 0) return 'selected-ok';
  if (balance >= -advanceDays) return 'selected-warning';
  return 'selected-overdrawn';
}

/**
 * Compute day statuses for all calendar dates in a single pass.
 *
 * Builds a sorted event timeline (earn/extra-grant/extra-expiry/expiry events) and
 * walks it together with sorted selected dates, maintaining per-vacation-year
 * running state incrementally. Complexity: O(D + E·log E + S·V).
 */
export function computeAllStatuses(
  dates: string[],
  selectedDates: string[],
  enabledHolidays: Record<string, boolean>,
  startDate: string,
  initialDays: number,
  extraDaysMonth: number,
  extraDaysCount: number,
  advanceDays: number,
  maxTransferDays: number = 5,
  earnFromSameMonth: boolean = true
): Record<string, DayStatus> {
  const selectedSet = new Set(selectedDates);
  const result = classifyStaticDates(dates, startDate, enabledHolidays, selectedSet);

  const sortedSelected = [...selectedDates].filter(d => !enabledHolidays[d]).sort();
  if (sortedSelected.length === 0) return result;

  // Determine vacation year range
  const firstVacationYear = getVacationYearForDate(startDate);
  const lastVacationYear = getVacationYearForDate(sortedSelected[sortedSelected.length - 1]);
  const vacationYearCount = lastVacationYear - firstVacationYear + 1;

  const employmentMonthStart = format(startOfMonth(parseISO(startDate)), 'yyyy-MM-dd');

  // Compute extra periods for the timeline window
  const lastSelectedDate = sortedSelected[sortedSelected.length - 1];
  const extraPeriodDefs = enumerateExtraPeriods(startDate, lastSelectedDate, extraDaysMonth, extraDaysCount, earnFromSameMonth);

  // Build extra pools mirroring the period defs (granted starts at 0; populated by grant events)
  const extraPools: ExtraPoolState[] = extraPeriodDefs.map(ep => ({
    startDate: ep.startDate,
    expiryDate: ep.expiryDate,
    granted: 0,
    used: 0,
    expired: false,
  }));

  const events = buildTimelineEvents(
    firstVacationYear, vacationYearCount, employmentMonthStart,
    earnFromSameMonth, extraPools
  );

  const vacationYears: VacationYearState[] = Array.from({ length: vacationYearCount }, (_, i) => ({
    earned: 0, used: 0, transferred: 0,
    expired: false, usableEnd: `${firstVacationYear + i + 1}-12-31`,
  }));

  // Walk selected dates and events together in sorted order
  let eventIdx = 0;
  for (const dateStr of sortedSelected) {
    // Apply all events up to this date
    for (; eventIdx < events.length && events[eventIdx].date <= dateStr; eventIdx++) {
      applyEvent(events[eventIdx], vacationYears, extraPools, extraDaysCount, initialDays, maxTransferDays);
    }

    allocateDay(dateStr, vacationYears, extraPools, initialDays);

    if (!(dateStr in result)) {
      const balance = computeTotalActiveBalance(vacationYears, extraPools, initialDays);
      result[dateStr] = statusFromBalance(balance, advanceDays);
    }
  }

  return result;
}
