export interface Holiday {
  date: string;
  name: string;
  enabled: boolean;
}

export interface DefaultData {
  holidays: Holiday[];
  extraHoliday: {
    defaultMonth: number;
    defaultCount: number;
  };
  advanceDays: number;
}

export type YearRange = 'current' | 'current+next';

export interface VacationState {
  startDate: string;
  initialVacationDays: number;
  extraDaysMonth: number;
  extraDaysCount: number;
  yearRange: YearRange;
  selectedDates: string[];
  enabledHolidays: Record<string, boolean>;
  holidays: Holiday[];
  advanceDays: number;
}

export type DayStatus =
  | 'normal'
  | 'weekend'
  | 'holiday'
  | 'selected-ok'
  | 'selected-warning'
  | 'selected-overdrawn';
