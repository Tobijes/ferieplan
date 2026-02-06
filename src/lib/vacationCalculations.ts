import {
  parseISO,
  differenceInMonths,
  isWeekend,
  isBefore,
  startOfMonth,
  addMonths,
  format,
} from 'date-fns';
import type { DayStatus, VacationYearBalance } from '@/types';

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

  // Step 1: Allocate used days earliest-first (before transfers)
  const usedDates = [...selectedDates]
    .filter((d) => !enabledHolidays[d] && d <= atDate)
    .sort();

  for (const d of usedDates) {
    let allocated = false;
    for (const b of balances) {
      const usableEnd = usablePeriodEnd(b.year);
      if (d <= usableEnd && b.balance - b.used > 0) {
        b.used += 1;
        allocated = true;
        break;
      }
    }
    if (!allocated) {
      for (let i = balances.length - 1; i >= 0; i--) {
        const usableEnd = usablePeriodEnd(balances[i].year);
        if (d <= usableEnd) {
          balances[i].used += 1;
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

// --- Status computation ---

/**
 * Compute day statuses for all calendar dates in a single pass.
 *
 * Instead of calling getVacationYearBalances per selected date (O(S²·V)),
 * this builds a sorted event timeline (earn/extra/expiry events) and
 * merge-walks it with sorted selected dates, maintaining per-vacation-year
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
  const result: Record<string, DayStatus> = {};
  const selectedSet = new Set(selectedDates);

  // --- Phase 1: Classify dates that don't need balance computation ---
  for (const dateStr of dates) {
    if (dateStr < startDate) {
      result[dateStr] = 'before-start';
      continue;
    }
    if (enabledHolidays[dateStr]) {
      result[dateStr] = 'holiday';
      continue;
    }
    if (selectedSet.has(dateStr)) continue; // deferred to Phase 3
    result[dateStr] = isWeekend(parseISO(dateStr)) ? 'weekend' : 'normal';
  }

  // --- Phase 2: Build event timeline ---
  const sortedSelected = [...selectedDates].filter(d => !enabledHolidays[d]).sort();
  if (sortedSelected.length === 0) return result;

  const firstVacationYear = getVacationYearForDate(startDate);
  const lastVacationYear = getVacationYearForDate(sortedSelected[sortedSelected.length - 1]);
  const vacationYearCount = lastVacationYear - firstVacationYear + 1;

  // Employment start rounded to month boundary (matches earnedInVacationYear)
  const employmentMonthStart = format(
    startOfMonth(parseISO(startDate)), 'yyyy-MM-dd'
  );

  // Event types: 0 = earn/extra (fire first at same date), 1 = expiry (fire after)
  const events: Array<{ date: string; priority: number; yearIndex: number; kind: 'earn' | 'extra' | 'expiry' }> = [];

  for (let i = 0; i < vacationYearCount; i++) {
    const year = firstVacationYear + i;
    const obtainStart = `${year}-09-01`;
    const obtainEndStr = `${year + 1}-09-01`; // exclusive end for month counting

    // Earn events: one per month-start in obtain period, after employment start
    const effectiveEarnStart = obtainStart > employmentMonthStart
      ? obtainStart : employmentMonthStart;
    let cur = parseISO(effectiveEarnStart);
    const obtainEndDate = parseISO(obtainEndStr);
    while (isBefore(cur, obtainEndDate)) {
      events.push({ date: format(cur, 'yyyy-MM-dd'), priority: 0, yearIndex: i, kind: 'earn' });
      cur = addMonths(cur, 1);
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

  // --- Phase 3: Merge-walk sorted selected dates with events ---
  const vacationYears = Array.from({ length: vacationYearCount }, (_, i) => ({
    earned: 0,
    extra: 0,
    used: 0,
    transferred: 0,
    expired: false,
    usableEnd: `${firstVacationYear + i + 1}-12-31`,
  }));

  let eventIdx = 0;

  for (const dateStr of sortedSelected) {
    // Apply all events with date <= current selected date
    while (eventIdx < events.length && events[eventIdx].date <= dateStr) {
      const event = events[eventIdx];
      const targetYear = vacationYears[event.yearIndex];
      switch (event.kind) {
        case 'earn':
          targetYear.earned += 2.08;
          break;
        case 'extra':
          targetYear.extra += extraDaysCount;
          break;
        case 'expiry': {
          // Compute balance of expiring vacation year to determine transfer
          const balance = targetYear.earned + targetYear.extra + targetYear.transferred - targetYear.used
            + (event.yearIndex === 0 ? initialDays : 0);
          targetYear.expired = true;
          if (balance > 0 && event.yearIndex + 1 < vacationYearCount) {
            vacationYears[event.yearIndex + 1].transferred = Math.min(balance, maxTransferDays);
          }
          break;
        }
      }
      eventIdx++;
    }

    // Allocate 1 day to earliest usable vacation year with positive balance.
    // Allocation uses earned+extra only (not transfers), matching the original
    // algorithm where allocation happens before transfer processing.
    let allocated = false;
    for (let i = 0; i < vacationYearCount; i++) {
      const vacationYear = vacationYears[i];
      if (dateStr <= vacationYear.usableEnd) {
        const allocBalance = vacationYear.earned + vacationYear.extra - vacationYear.used
          + (i === 0 ? initialDays : 0);
        if (allocBalance > 0) {
          vacationYear.used += 1;
          allocated = true;
          break;
        }
      }
    }
    if (!allocated) {
      // Fallback: latest usable vacation year (allows borrowing / negative balance)
      for (let i = vacationYearCount - 1; i >= 0; i--) {
        if (dateStr <= vacationYears[i].usableEnd) {
          vacationYears[i].used += 1;
          break;
        }
      }
    }

    // Compute total active balance (including transfers) for status
    let totalBalance = 0;
    for (let i = 0; i < vacationYearCount; i++) {
      if (!vacationYears[i].expired) {
        const vacationYear = vacationYears[i];
        totalBalance += vacationYear.earned + vacationYear.extra + vacationYear.transferred - vacationYear.used
          + (i === 0 ? initialDays : 0);
      }
    }

    // Assign status only for dates not already classified in Phase 1
    if (!(dateStr in result)) {
      result[dateStr] = totalBalance >= 0
        ? 'selected-ok'
        : totalBalance >= -advanceDays
          ? 'selected-warning'
          : 'selected-overdrawn';
    }
  }

  return result;
}
