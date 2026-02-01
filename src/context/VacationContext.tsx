import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toISODate } from '@/lib/dateUtils';
import type { Holiday, VacationState } from '@/types';

const defaultState: VacationState = {
  startDate: toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  initialVacationDays: 0,
  extraDaysMonth: 5,
  extraDaysCount: 5,
  yearRange: 'current',
  selectedDates: [],
  enabledHolidays: {},
  holidays: [],
};

interface VacationContextType {
  state: VacationState;
  setState: (value: VacationState | ((prev: VacationState) => VacationState)) => void;
  toggleDate: (dateStr: string) => void;
  toggleHoliday: (dateStr: string) => void;
  initDefaults: (holidays: Holiday[], extraMonth: number, extraCount: number) => void;
  addHoliday: (date: string, name: string) => void;
  resetState: () => void;
  holidayNames: Record<string, string>;
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

  const holidayNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const h of state.holidays) {
      names[h.date] = h.name;
    }
    return names;
  }, [state.holidays]);

  const setHighlightedDate = useCallback((date: string | null) => {
    const container = calendarRef.current;
    if (!container) return;
    container.querySelectorAll('[data-highlighted="true"]').forEach((el) => {
      el.removeAttribute('data-highlighted');
    });
    if (date) {
      container.querySelector(`[data-date="${date}"]`)?.setAttribute('data-highlighted', 'true');
    }
  }, []);

  const toggleDate = useCallback((dateStr: string) => {
    setState((prev) => {
      const selected = prev.selectedDates.includes(dateStr)
        ? prev.selectedDates.filter((d) => d !== dateStr)
        : [...prev.selectedDates, dateStr].sort();
      return { ...prev, selectedDates: selected };
    });
  }, [setState]);

  const toggleHoliday = useCallback((dateStr: string) => {
    setState((prev) => ({
      ...prev,
      enabledHolidays: {
        ...prev.enabledHolidays,
        [dateStr]: !prev.enabledHolidays[dateStr],
      },
    }));
  }, [setState]);

  const initDefaults = useCallback((holidays: Holiday[], extraMonth: number, extraCount: number) => {
    setState((prev) => {
      if (prev.holidays.length > 0) return prev;
      const enabled: Record<string, boolean> = {};
      for (const h of holidays) {
        enabled[h.date] = h.enabled;
      }
      return { ...prev, holidays, enabledHolidays: enabled, extraDaysMonth: extraMonth, extraDaysCount: extraCount };
    });
  }, [setState]);

  const addHoliday = useCallback((date: string, name: string) => {
    setState((prev) => ({
      ...prev,
      holidays: [...prev.holidays, { date, name, enabled: true }].sort((a, b) => a.date.localeCompare(b.date)),
      enabledHolidays: { ...prev.enabledHolidays, [date]: true },
    }));
  }, [setState]);

  const resetState = useCallback(() => {
    setState({ ...defaultState, startDate: toISODate(new Date()) });
  }, [setState]);

  const value = useMemo(() => ({ state, setState, toggleDate, toggleHoliday, initDefaults, addHoliday, resetState, holidayNames, setHighlightedDate, calendarRef }), [state, setState, toggleDate, toggleHoliday, initDefaults, addHoliday, resetState, holidayNames, setHighlightedDate]);

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
