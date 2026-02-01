import {
  parseISO,
  differenceInMonths,
  isWeekend,
  isBefore,
  isEqual,
} from 'date-fns';
import type { DayStatus } from '@/types';

function calculateEarnedDays(
  startDate: string,
  targetDate: string
): number {
  const start = parseISO(startDate);
  const target = parseISO(targetDate);
  const months = differenceInMonths(target, start);
  if (months <= 0) return 0;
  return months * 2.08;
}

function calculateExtraDays(
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

function countUsedDays(
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

export function getDayStatus(
  dateStr: string,
  selectedDates: string[],
  enabledHolidays: Record<string, boolean>,
  startDate: string,
  initialDays: number,
  extraDaysMonth: number,
  extraDaysCount: number
): DayStatus {
  const date = parseISO(dateStr);

  if (enabledHolidays[dateStr]) {
    return 'holiday';
  }

  if (isWeekend(date) && !selectedDates.includes(dateStr)) {
    return 'weekend';
  }

  if (selectedDates.includes(dateStr)) {
    const balance = getBalance(
      startDate,
      initialDays,
      extraDaysMonth,
      extraDaysCount,
      selectedDates,
      enabledHolidays,
      dateStr
    );
    return balance >= 0 ? 'selected-ok' : 'selected-warning';
  }

  if (isWeekend(date)) {
    return 'weekend';
  }

  return 'normal';
}
