import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toISODate, generateMonths } from '@/lib/dateUtils';
import { computeAllStatuses } from '@/lib/vacationCalculations';
import { eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import type { Holiday, DayStatus, VacationState } from '@/types';

export const defaultState: VacationState = {
  startDate: toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  initialVacationDays: 0,
  extraDaysMonth: 5,
  extraDaysCount: 5,
  selectedDates: [],
  enabledHolidays: {},
  holidays: [],
  advanceDays: 0,
  maxTransferDays: 5,
};

interface VacationContextType {
  state: VacationState;
  setState: (value: VacationState | ((prev: VacationState) => VacationState)) => void;
  toggleDate: (dateStr: string) => void;
  toggleHoliday: (dateStr: string) => void;
  initDefaults: (holidays: Holiday[], extraMonth: number, extraCount: number, advanceDays: number, maxTransferDays: number) => void;
  addHoliday: (date: string, name: string) => void;
  resetState: () => void;
  holidayNames: Record<string, string>;
  dayStatuses: Record<string, DayStatus>;
  visibleYears: number[];
  setHighlightedDate: (date: string | null) => void;
  calendarRef: React.RefObject<HTMLDivElement | null>;
}

const VacationCtx = createContext<VacationContextType | null>(null);

export function VacationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorage<VacationState>(
    'ferieplan-state',
    defaultState
  );
  const calendarRef = useRef<HTMLDivElement | null>(null);

  const holidayNames: Record<string, string> = {};
  for (const h of state.holidays) {
    holidayNames[h.date] = h.name;
  }

  const setHighlightedDate = (date: string | null) => {
    const container = calendarRef.current;
    if (!container) return;
    container.querySelectorAll('[data-highlighted="true"]').forEach((el) => {
      el.removeAttribute('data-highlighted');
    });
    if (date) {
      container.querySelector(`[data-date="${date}"]`)?.setAttribute('data-highlighted', 'true');
    }
  };

  const toggleDate = (dateStr: string) => {
    setState((prev) => {
      const selected = prev.selectedDates.includes(dateStr)
        ? prev.selectedDates.filter((d) => d !== dateStr)
        : [...prev.selectedDates, dateStr].sort();
      return { ...prev, selectedDates: selected };
    });
  };

  const toggleHoliday = (dateStr: string) => {
    setState((prev) => ({
      ...prev,
      enabledHolidays: {
        ...prev.enabledHolidays,
        [dateStr]: !prev.enabledHolidays[dateStr],
      },
    }));
  };

  const initDefaults = (holidays: Holiday[], extraMonth: number, extraCount: number, advanceDays: number, maxTransferDays: number) => {
    setState((prev) => {
      if (prev.holidays.length === 0) {
        // First-time seed: set all defaults
        const enabled: Record<string, boolean> = {};
        for (const h of holidays) {
          enabled[h.date] = h.enabled;
        }
        return { ...prev, holidays, enabledHolidays: enabled, extraDaysMonth: extraMonth, extraDaysCount: extraCount, advanceDays, maxTransferDays };
      }

      // Merge: add holidays from defaults missing in state
      const existingDates = new Set(prev.holidays.map(h => h.date));
      const newHolidays = holidays.filter(h => !existingDates.has(h.date));
      if (newHolidays.length === 0) return prev;

      const mergedHolidays = [...prev.holidays, ...newHolidays].sort((a, b) => a.date.localeCompare(b.date));
      const mergedEnabled = { ...prev.enabledHolidays };
      for (const h of newHolidays) {
        mergedEnabled[h.date] = h.enabled;
      }
      return { ...prev, holidays: mergedHolidays, enabledHolidays: mergedEnabled };
    });
  };

  const addHoliday = (date: string, name: string) => {
    setState((prev) => ({
      ...prev,
      holidays: [...prev.holidays, { date, name, enabled: true }].sort((a, b) => a.date.localeCompare(b.date)),
      enabledHolidays: { ...prev.enabledHolidays, [date]: true },
    }));
  };

  const resetState = () => {
    setState({ ...defaultState, startDate: toISODate(new Date()) });
  };

  const currentYear = new Date().getFullYear();
  const holidayYears = new Set(state.holidays.map(h => parseInt(h.date.slice(0, 4), 10)));
  holidayYears.add(currentYear);
  const visibleYears = [...holidayYears].sort((a, b) => a - b);

  const months = generateMonths(visibleYears);
  const allDates: string[] = [];
  for (const m of months) {
    const days = eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) });
    for (const d of days) {
      allDates.push(toISODate(d));
    }
  }
  const dayStatuses = computeAllStatuses(
    allDates,
    state.selectedDates,
    state.enabledHolidays,
    state.startDate,
    state.initialVacationDays,
    state.extraDaysMonth,
    state.extraDaysCount,
    state.advanceDays,
    state.maxTransferDays
  );

  const value = { state, setState, toggleDate, toggleHoliday, initDefaults, addHoliday, resetState, holidayNames, dayStatuses, visibleYears, setHighlightedDate, calendarRef };

  return (
    <VacationCtx.Provider value={value}>
      {children}
    </VacationCtx.Provider>
  );
}

export function useVacation() {
  const ctx = useContext(VacationCtx);
  if (!ctx) throw new Error('useVacation must be used within VacationProvider');
  return ctx;
}
