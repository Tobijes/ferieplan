export interface Holiday {
  date: string;
  name: string;
}

export interface HolidayData {
  holidays: Holiday[];
}

export type YearRange = 'current' | 'current+next';

export interface VacationState {
  startDate: string;
  initialVacationDays: number;
  extraDaysMonth: number;
  yearRange: YearRange;
  selectedDates: string[];
  enabledHolidays: Record<string, boolean>;
}

export type DayStatus =
  | 'normal'
  | 'weekend'
  | 'holiday'
  | 'selected-ok'
  | 'selected-warning';
