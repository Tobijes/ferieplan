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
  maxTransferDays: number;
}

export interface VacationState {
  startDate: string;
  initialVacationDays: number;
  extraDaysMonth: number;
  extraDaysCount: number;
  selectedDates: string[];
  enabledHolidays: Record<string, boolean>;
  holidays: Holiday[];
  advanceDays: number;
  maxTransferDays: number;
}

export interface VacationYearBalance {
  year: number;        // vacation year start year (e.g. 2025 = Sep 2025 → Aug 2026, usable until Dec 2026)
  earned: number;      // days earned so far in this vacation year
  extra: number;       // extra days granted in this vacation year
  used: number;        // days consumed from this vacation year
  transferred: number; // days transferred from previous expired vacation year (max 5)
  balance: number;     // earned + extra + transferred - used
  lost: number;        // days lost at expiry (excess beyond 5 transferable)
  expired: boolean;    // true if atDate > Dec 31 of year+1
}

export type DayStatus =
  | 'normal'
  | 'weekend'
  | 'holiday'
  | 'selected-ok'
  | 'selected-warning'
  | 'selected-overdrawn'
  | 'before-start';
