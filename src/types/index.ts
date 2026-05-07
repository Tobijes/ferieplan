
import type { Account } from "./account";
import type { Month } from "./month";

export interface Holiday {
  date: string;
  name: string;
  enabled: boolean;
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

export interface VacationBalances {
  startMonth: Month;
  endMonth: Month;
  selectedAccount: Account;
  vacationAccounts: Account[];
  extraDaysAccounts: Account[];
  boughtDaysAccount: Account;
  lostDaysAccount: Account,
  transferDaysAccount: Account
}


export type DayStatus =
  | "normal"
  | "weekend"
  | "holiday"
  | "selected-ok"
  | "selected-warning"
  | "selected-overdrawn"
  | "before-start";

export type SyncStatus =
  | "disconnected"
  | "syncing"
  | "synced"
  | "pending"
  | "error";
