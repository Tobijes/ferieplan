import {
  parseISO,
  differenceInMonths,
  isWeekend,
  isBefore,
  isEqual,
} from 'date-fns';
import type { DayStatus, FerieaarBalance } from '@/types';

// --- Low-level helpers (exported for testing) ---

export function calculateEarnedDays(
  startDate: string,
  targetDate: string
): number {
  const start = parseISO(startDate);
  const target = parseISO(targetDate);
  const months = differenceInMonths(target, start);
  if (months <= 0) return 0;
  return months * 2.08;
}

export function calculateExtraDays(
  startDate: string,
  targetDate: string,
  extraDaysMonth: number,
  extraDaysCount: number
): number {
  const start = parseISO(startDate);
  const target = parseISO(targetDate);
  let total = 0;
  const startYear = start.getFullYear();
  const targetYear = target.getFullYear();
  for (let y = startYear; y <= targetYear; y++) {
    const extraDate = new Date(y, extraDaysMonth - 1, 1);
    if (extraDate >= start && extraDate <= target) {
      total += extraDaysCount;
    }
  }
  return total;
}

export function countUsedDays(
  selectedDates: string[],
  enabledHolidays: Record<string, boolean>,
  upToDate: string
): number {
  const target = parseISO(upToDate);
  return selectedDates.filter((d) => {
    if (enabledHolidays[d]) return false;
    const date = parseISO(d);
    return isBefore(date, target) || isEqual(date, target);
  }).length;
}

// --- Legacy single-balance function (kept for backward compat during transition) ---

export function getBalance(
  startDate: string,
  initialDays: number,
  extraDaysMonth: number,
  extraDaysCount: number,
  selectedDates: string[],
  enabledHolidays: Record<string, boolean>,
  atDate: string
): number {
  const earned = calculateEarnedDays(startDate, atDate);
  const extra = calculateExtraDays(startDate, atDate, extraDaysMonth, extraDaysCount);
  const used = countUsedDays(selectedDates, enabledHolidays, atDate);
  return initialDays + earned + extra - used;
}

// --- Per-ferieår balance system ---

/**
 * Get the ferieår start year for a given date.
 * Ferieår N runs Sep 1 Year N → Aug 31 Year N+1.
 * A date in Jan-Aug belongs to ferieår (year-1), Sep-Dec belongs to ferieår (year).
 */
export function getFerieaarForDate(dateStr: string): number {
  const d = parseISO(dateStr);
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  return month >= 8 ? year : year - 1; // Aug=7 → prev year, Sep=8 → this year
}

/**
 * Obtain period for ferieår N: Sep 1 Year N → Aug 31 Year N+1
 */
function obtainPeriod(ferieaar: number): { start: string; end: string } {
  return {
    start: `${ferieaar}-09-01`,
    end: `${ferieaar + 1}-09-01`, // Use Sep 1 (exclusive) for month counting
  };
}

/**
 * Usable period for ferieår N: Sep 1 Year N → Dec 31 Year N+1
 */
function usablePeriodEnd(ferieaar: number): string {
  return `${ferieaar + 1}-12-31`;
}


/**
 * Compute earned days for a specific ferieår at a given date.
 * Only counts months within the obtain period that have elapsed by atDate.
 */
function earnedInFerieaar(
  ferieaar: number,
  atDate: string,
  employmentStartDate: string
): number {
  const obtain = obtainPeriod(ferieaar);
  // Effective start is the later of obtain period start and employment start
  const effectiveStart = obtain.start > employmentStartDate ? obtain.start : employmentStartDate;
  // Effective end is the earlier of obtain period end and atDate
  const effectiveEnd = obtain.end < atDate ? obtain.end : atDate;

  if (effectiveStart > effectiveEnd) return 0;

  const start = parseISO(effectiveStart);
  const end = parseISO(effectiveEnd);
  const months = differenceInMonths(end, start);
  if (months <= 0) return 0;
  return months * 2.08;
}

/**
 * Compute extra days for a specific ferieår at a given date.
 * Extra days are granted in the configured month if it falls within the ferieår's obtain period.
 */
function extraInFerieaar(
  ferieaar: number,
  atDate: string,
  employmentStartDate: string,
  extraDaysMonth: number,
  extraDaysCount: number
): number {
  const obtain = obtainPeriod(ferieaar);
  const effectiveStart = obtain.start > employmentStartDate ? obtain.start : employmentStartDate;

  // Check each calendar year that overlaps with the obtain period
  let total = 0;
  for (const y of [ferieaar, ferieaar + 1]) {
    const extraDateStr = `${y}-${String(extraDaysMonth).padStart(2, '0')}-01`;
    if (extraDateStr >= effectiveStart && extraDateStr <= obtain.end && extraDateStr <= atDate) {
      total += extraDaysCount;
    }
  }
  return total;
}

/**
 * Compute per-ferieår balances at a given date.
 * Allocates used days to the earliest available (non-expired) ferieår first.
 */
export function getFerieaarBalances(
  startDate: string,
  initialDays: number,
  extraDaysMonth: number,
  extraDaysCount: number,
  selectedDates: string[],
  enabledHolidays: Record<string, boolean>,
  atDate: string,
  maxTransferDays: number = 5
): FerieaarBalance[] {
  // Determine range of ferieår to consider
  const startFerieaar = getFerieaarForDate(startDate);
  const endFerieaar = getFerieaarForDate(atDate);
  // Also include the ferieår before endFerieaar if its usable period hasn't ended
  const ferieaarYears: number[] = [];
  for (let y = startFerieaar; y <= endFerieaar; y++) {
    ferieaarYears.push(y);
  }

  // Build balance objects
  const balances: FerieaarBalance[] = ferieaarYears.map((year) => {
    const earned = earnedInFerieaar(year, atDate, startDate);
    const extra = extraInFerieaar(year, atDate, startDate, extraDaysMonth, extraDaysCount);
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

  // Add initial days to the earliest ferieår
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

  // Step 3: Process transfers from expired ferieår to the next one
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

/**
 * Get total balance across all active (non-expired) ferieår.
 */
export function getTotalBalance(balances: FerieaarBalance[]): number {
  return balances
    .filter((b) => !b.expired)
    .reduce((sum, b) => sum + b.balance - b.used, 0);
}

// --- Status computation ---

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
  const sortedSelected = [...selectedDates].filter(d => !enabledHolidays[d]).sort();

  for (const dateStr of dates) {
    if (dateStr < startDate) {
      result[dateStr] = 'before-start';
      continue;
    }

    const date = parseISO(dateStr);

    if (enabledHolidays[dateStr]) {
      result[dateStr] = 'holiday';
      continue;
    }

    if (isWeekend(date) && !selectedSet.has(dateStr)) {
      result[dateStr] = 'weekend';
      continue;
    }

    if (selectedSet.has(dateStr)) {
      // Use per-ferieår balances to determine status
      const balances = getFerieaarBalances(
        startDate, initialDays, extraDaysMonth, extraDaysCount,
        sortedSelected, enabledHolidays, dateStr, maxTransferDays
      );
      const totalBalance = balances
        .filter((b) => !b.expired)
        .reduce((sum, b) => sum + b.balance, 0);

      result[dateStr] = totalBalance >= 0
        ? 'selected-ok'
        : totalBalance >= -advanceDays
          ? 'selected-warning'
          : 'selected-overdrawn';
      continue;
    }

    if (isWeekend(date)) {
      result[dateStr] = 'weekend';
      continue;
    }

    result[dateStr] = 'normal';
  }

  return result;
}
