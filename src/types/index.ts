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
  maxTransferDays: number;
}

export interface FerieaarBalance {
  year: number;        // ferieår start year (e.g. 2025 = Sep 2025 → Aug 2026, usable until Dec 2026)
  earned: number;      // days earned so far in this ferieår
  extra: number;       // extra days granted in this ferieår
  used: number;        // days consumed from this ferieår
  transferred: number; // days transferred from previous expired ferieår (max 5)
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
