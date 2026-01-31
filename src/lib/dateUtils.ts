import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import type { YearRange } from '@/types';

export const DA_DAY_NAMES = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

export function formatMonthYear(date: Date): string {
  const str = format(date, 'MMMM yyyy', { locale: da });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function generateMonths(yearRange: YearRange): Date[] {
  const currentYear = new Date().getFullYear();
  const years = yearRange === 'current'
    ? [currentYear]
    : [currentYear, currentYear + 1];
  const months: Date[] = [];
  for (const y of years) {
    for (let m = 0; m < 12; m++) {
      months.push(new Date(y, m, 1));
    }
  }
  return months;
}

export function getVisibleYears(yearRange: YearRange): number[] {
  const currentYear = new Date().getFullYear();
  return yearRange === 'current'
    ? [currentYear]
    : [currentYear, currentYear + 1];
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
