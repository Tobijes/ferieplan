import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toISODate } from '@/lib/dateUtils';
import type { VacationState } from '@/types';

const defaultState: VacationState = {
  startDate: toISODate(new Date()),
  initialVacationDays: 0,
  extraDaysMonth: 5,
  yearRange: 'current',
  selectedDates: [],
  enabledHolidays: {},
};

interface VacationContextType {
  state: VacationState;
  setState: (value: VacationState | ((prev: VacationState) => VacationState)) => void;
  toggleDate: (dateStr: string) => void;
  toggleHoliday: (dateStr: string) => void;
  initHolidays: (dates: string[], names: Record<string, string>) => void;
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
  const [holidayNames, setHolidayNames] = useState<Record<string, string>>({});
  const calendarRef = useRef<HTMLDivElement | null>(null);

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

  const holidayNamesRef = useRef(false);
  const initHolidays = useCallback((dates: string[], names: Record<string, string>) => {
    if (!holidayNamesRef.current) {
      holidayNamesRef.current = true;
      setHolidayNames(names);
    }
    setState((prev) => {
      const existing = prev.enabledHolidays;
      const hasAny = Object.keys(existing).length > 0;
      if (hasAny) return prev;
      const enabled: Record<string, boolean> = {};
      for (const d of dates) {
        enabled[d] = true;
      }
      return { ...prev, enabledHolidays: enabled };
    });
  }, [setState]);

  const resetState = useCallback(() => {
    holidayNamesRef.current = false;
    setState({ ...defaultState, startDate: toISODate(new Date()) });
  }, [setState]);

  const value = useMemo(() => ({ state, setState, toggleDate, toggleHoliday, initHolidays, resetState, holidayNames, setHighlightedDate, calendarRef }), [state, setState, toggleDate, toggleHoliday, initHolidays, resetState, holidayNames, setHighlightedDate]);

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
