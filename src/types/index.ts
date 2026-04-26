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
  earnFromSameMonth: boolean;
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
  earnFromSameMonth: boolean;
}

export interface VacationYearBalance {
  year: number;        // vacation year start year (e.g. 2025 = Sep 2025 → Aug 2026, usable until Dec 2026)
  earned: number;      // days earned so far in this vacation year
  used: number;        // days consumed from this vacation year
  transferred: number; // days transferred from previous expired vacation year (max maxTransferDays)
  balance: number;     // earned + transferred - used
  lost: number;        // earned-day surplus lost at expiry (excess beyond maxTransferDays)
  expired: boolean;    // true if atDate > Dec 31 of year+1
}

export interface ExtraDayPeriod {
  startDate: string;   // first usable ISO date (1st of extraDaysMonth, or next month if !earnFromSameMonth)
  expiryDate: string;  // first NON-usable ISO date (exclusive) — 1st of extraDaysMonth next year
  granted: number;     // = extraDaysCount for this period
  used: number;        // days consumed against this period
  balance: number;     // granted - used (snapped to 0 within EPS)
  expired: boolean;    // atDate >= expiryDate
}

export interface VacationYearBalancesResult {
  vacationYears: VacationYearBalance[];
  extraPeriods: ExtraDayPeriod[];
}

export type DayStatus =
  | 'normal'
  | 'weekend'
  | 'holiday'
  | 'selected-ok'
  | 'selected-warning'
  | 'selected-overdrawn'
  | 'before-start';

export type SyncStatus = 'disconnected' | 'syncing' | 'synced' | 'pending' | 'error';
