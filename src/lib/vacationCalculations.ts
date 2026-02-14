import {
  parseISO,
  differenceInMonths,
  isWeekend,
  startOfMonth,
  addMonths,
  format,
} from 'date-fns';
import type { DayStatus, VacationYearBalance } from '@/types';

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
  employmentStartDate: string
): number {
  const obtain = obtainPeriod(vacationYear);

  // Round employment start to beginning of month (if you start mid-month, you still get that month's days)
  const employmentStartMonthStart = format(startOfMonth(parseISO(employmentStartDate)), 'yyyy-MM-dd');

  // Effective start is the later of obtain period start and employment start month
  const effectiveStart = obtain.start > employmentStartMonthStart ? obtain.start : employmentStartMonthStart;

  // Calculate to start of next month after atDate, so days are usable from the start of each month
  const atDateParsed = parseISO(atDate);
  const nextMonthStart = format(addMonths(startOfMonth(atDateParsed), 1), 'yyyy-MM-dd');

  // Effective end is the earlier of obtain period end and next month start
  const effectiveEnd = obtain.end < nextMonthStart ? obtain.end : nextMonthStart;

  if (effectiveStart > effectiveEnd) return 0;

  const start = parseISO(effectiveStart);
  const end = parseISO(effectiveEnd);
  const months = differenceInMonths(end, start);
  if (months <= 0) return 0;
  return months * 2.08;
}

/**
 * Compute extra days for a specific vacation year at a given date.
 * Extra days are granted in the configured month if it falls within the vacation year's obtain period.
 */
function extraInVacationYear(
  vacationYear: number,
  atDate: string,
  employmentStartDate: string,
  extraDaysMonth: number,
  extraDaysCount: number
): number {
  const obtain = obtainPeriod(vacationYear);
  const effectiveStart = obtain.start > employmentStartDate ? obtain.start : employmentStartDate;

  // Check each calendar year that overlaps with the obtain period
  let total = 0;
  for (const y of [vacationYear, vacationYear + 1]) {
    const extraDateStr = `${y}-${String(extraDaysMonth).padStart(2, '0')}-01`;
    if (extraDateStr >= effectiveStart && extraDateStr <= obtain.end && extraDateStr <= atDate) {
      total += extraDaysCount;
    }
  }
  return total;
}

/**
 * Compute per-vacation-year balances at a given date.
 * Allocates used days to the earliest available (non-expired) vacation year first.
 */
export function getVacationYearBalances(
  startDate: string,
  initialDays: number,
  extraDaysMonth: number,
  extraDaysCount: number,
  selectedDates: string[],
  enabledHolidays: Record<string, boolean>,
  atDate: string,
  maxTransferDays: number = 5
): VacationYearBalance[] {
  // Determine range of vacation years to consider
  const startVacationYear = getVacationYearForDate(startDate);
  const endVacationYear = getVacationYearForDate(atDate);
  // Also include the vacation year before endVacationYear if its usable period hasn't ended
  const vacationYears: number[] = [];
  for (let y = startVacationYear; y <= endVacationYear; y++) {
    vacationYears.push(y);
  }

  // Build balance objects
  const balances: VacationYearBalance[] = vacationYears.map((year) => {
    const earned = earnedInVacationYear(year, atDate, startDate);
    const extra = extraInVacationYear(year, atDate, startDate, extraDaysMonth, extraDaysCount);
    const expEnd = usablePeriodEnd(year);
    const expired = atDate > expEnd;

    return {
      year,
      earned,
      extra,
      used: 0,
      transferred: 0,
      balance: earned + extra,
      lost: 0,
      expired,
    };
  });

  // Add initial days to the earliest vacation year
  if (balances.length > 0) {
    balances[0].balance += initialDays;
  }

  // Step 1: Allocate used days earliest-first with waterfall splitting (before transfers)
  const usedDates = [...selectedDates]
    .filter((d) => !enabledHolidays[d] && d <= atDate)
    .sort();

  for (const d of usedDates) {
    let remaining = 1;

    // Pass 1: consume from earliest year with positive available balance
    for (const b of balances) {
      if (remaining <= EPS) break;
      const usableEnd = usablePeriodEnd(b.year);
      if (d <= usableEnd) {
        const available = b.balance - b.used;
        if (available > EPS) {
          const consume = Math.min(available, remaining);
          b.used += consume;
          remaining -= consume;
        }
      }
    }

    // Pass 2: borrow from latest usable year
    if (remaining > EPS) {
      for (let i = balances.length - 1; i >= 0; i--) {
        const usableEnd = usablePeriodEnd(balances[i].year);
        if (d <= usableEnd) {
          balances[i].used += remaining;
          break;
        }
      }
    }
  }

  // Step 2: Recalculate balances after usage
  for (let i = 0; i < balances.length; i++) {
    const b = balances[i];
    b.balance = b.earned + b.extra + b.transferred - b.used;
    if (i === 0) b.balance += initialDays;
    if (Math.abs(b.balance) < EPS) b.balance = 0;
  }

  // Step 3: Process transfers from expired vacation year to the next one
  for (let i = 0; i < balances.length - 1; i++) {
    const b = balances[i];
    if (b.expired && b.balance > 0) {
      const transferable = Math.min(b.balance, maxTransferDays);
      b.lost = Math.max(0, b.balance - maxTransferDays);
      balances[i + 1].transferred = transferable;
      balances[i + 1].balance += transferable;
    }
  }

  return balances;
}

// --- Status computation helpers ---

export interface VacationYearState {
  earned: number;
  extra: number;
  used: number;
  transferred: number;
  expired: boolean;
  usableEnd: string;
}

export interface TimelineEvent {
  date: string;
  priority: number;    // 0 = earn/extra (applied first), 1 = expiry (applied after)
  yearIndex: number;
  kind: 'earn' | 'extra' | 'expiry';
}

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
 * Build a sorted timeline of earn, extra, and expiry events
 * across all vacation years.
 */
export function buildTimelineEvents(
  firstVacationYear: number,
  vacationYearCount: number,
  employmentMonthStart: string,
  startDate: string,
  extraDaysMonth: number
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
      events.push({
        date: format(addMonths(effectiveEarnStartDate, m), 'yyyy-MM-dd'),
        priority: 0, yearIndex: i, kind: 'earn',
      });
    }

    // Extra events: check both calendar years overlapping the obtain period
    const effectiveExtraStart = obtainStart > startDate ? obtainStart : startDate;
    for (const calendarYear of [year, year + 1]) {
      const extraDateStr = `${calendarYear}-${String(extraDaysMonth).padStart(2, '0')}-01`;
      if (extraDateStr >= effectiveExtraStart && extraDateStr <= obtainEndStr) {
        events.push({ date: extraDateStr, priority: 0, yearIndex: i, kind: 'extra' });
      }
    }

    // Expiry event: vacation year expires after Dec 31 of year+1
    events.push({ date: `${year + 2}-01-01`, priority: 1, yearIndex: i, kind: 'expiry' });
  }

  // Sort by (date, priority) so earn/extra fire before expiry at the same date
  events.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    return cmp !== 0 ? cmp : a.priority - b.priority;
  });

  return events;
}

/**
 * Apply a single timeline event to the vacation year state.
 */
export function applyEvent(
  event: TimelineEvent,
  vacationYears: VacationYearState[],
  extraDaysCount: number,
  initialDays: number,
  maxTransferDays: number
): void {
  const target = vacationYears[event.yearIndex];
  switch (event.kind) {
    case 'earn':
      target.earned += 2.08;
      break;
    case 'extra':
      target.extra += extraDaysCount;
      break;
    case 'expiry': {
      const balance = target.earned + target.extra + target.transferred - target.used
        + (event.yearIndex === 0 ? initialDays : 0);
      target.expired = true;
      if (balance > 0 && event.yearIndex + 1 < vacationYears.length) {
        vacationYears[event.yearIndex + 1].transferred = Math.min(balance, maxTransferDays);
      }
      break;
    }
  }
}

/**
 * Allocate 1 used day across vacation years using waterfall allocation.
 * Consumes from the earliest usable year first; if that year has less than 1 day
 * of balance, takes what it can and carries the remainder to the next year.
 * Falls back to the latest usable year if all are exhausted (allows borrowing).
 */
export function allocateDay(
  dateStr: string,
  vacationYears: VacationYearState[],
  initialDays: number
): void {
  let remaining = 1;

  // Pass 1: consume from earliest years with positive balance
  for (let i = 0; i < vacationYears.length && remaining > EPS; i++) {
    const vy = vacationYears[i];
    if (dateStr <= vy.usableEnd) {
      const balance = vy.earned + vy.extra + vy.transferred - vy.used
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
 * Sum balances across all non-expired vacation years.
 */
export function computeTotalActiveBalance(
  vacationYears: VacationYearState[],
  initialDays: number
): number {
  let total = 0;
  for (let i = 0; i < vacationYears.length; i++) {
    const vy = vacationYears[i];
    if (!vy.expired) {
      total += vy.earned + vy.extra + vy.transferred - vy.used
        + (i === 0 ? initialDays : 0);
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
 * Builds a sorted event timeline (earn/extra/expiry events) and
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
  maxTransferDays: number = 5
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
  const events = buildTimelineEvents(firstVacationYear, vacationYearCount, employmentMonthStart, startDate, extraDaysMonth);

  const vacationYears: VacationYearState[] = Array.from({ length: vacationYearCount }, (_, i) => ({
    earned: 0, extra: 0, used: 0, transferred: 0,
    expired: false, usableEnd: `${firstVacationYear + i + 1}-12-31`,
  }));

  // Walk selected dates and events together in sorted order
  let eventIdx = 0;
  for (const dateStr of sortedSelected) {
    // Apply all events up to this date
    for (; eventIdx < events.length && events[eventIdx].date <= dateStr; eventIdx++) {
      applyEvent(events[eventIdx], vacationYears, extraDaysCount, initialDays, maxTransferDays);
    }

    allocateDay(dateStr, vacationYears, initialDays);

    if (!(dateStr in result)) {
      const balance = computeTotalActiveBalance(vacationYears, initialDays);
      result[dateStr] = statusFromBalance(balance, advanceDays);
    }
  }

  return result;
}
