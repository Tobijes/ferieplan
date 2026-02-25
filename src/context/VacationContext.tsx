import { createContext, useContext, useRef, useState, useEffect, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toISODate, generateMonths } from '@/lib/dateUtils';
import { computeAllStatuses } from '@/lib/vacationCalculations';
import { eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { saveStateToCloud, loadStateFromCloud, getCloudGeneration } from '@/lib/cloudStorage';
import type { Holiday, DayStatus, VacationState, SyncStatus } from '@/types';

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

type SyncConflict = { type: 'upload' } | null;

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
  syncStatus: SyncStatus;
  syncConflict: SyncConflict;
  resolveSyncConflict: (choice: 'upload' | 'download') => Promise<void>;
}

const VacationCtx = createContext<VacationContextType | null>(null);

const GENERATION_KEY = 'ferieplan-cloud-generation';

function getLocalGeneration(): string | null {
  try {
    return localStorage.getItem(GENERATION_KEY);
  } catch {
    return null;
  }
}

function setLocalGeneration(gen: string | null) {
  try {
    if (gen) {
      localStorage.setItem(GENERATION_KEY, gen);
    } else {
      localStorage.removeItem(GENERATION_KEY);
    }
  } catch {
    // localStorage unavailable
  }
}

export function VacationProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [state, setState] = useLocalStorage<VacationState>(
    'ferieplan-state',
    defaultState
  );
  const calendarRef = useRef<HTMLDivElement | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => user ? 'syncing' : 'disconnected');
  const [syncConflict, setSyncConflict] = useState<SyncConflict>(null);

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedJsonRef = useRef<string>('');
  const generationRef = useRef<string | null>(getLocalGeneration());
  const syncStartedRef = useRef(false);

  // On auth state change: handle initial cloud sync
  useEffect(() => {
    if (loading) return; // Wait for Firebase to resolve auth state

    if (!user) {
      syncStartedRef.current = false;
      lastSyncedJsonRef.current = '';
      // Keep local data, but clear generation
      generationRef.current = null;
      setLocalGeneration(null);
      setSyncStatus('disconnected');
      setSyncConflict(null);
      return;
    }
    if (syncStartedRef.current) return;
    syncStartedRef.current = true;

    const uid = user.uid;

    (async () => {
      try {
        setSyncStatus('syncing');

        // If we have a cached generation, this is a page reload while logged in
        const localGen = generationRef.current;
        if (localGen) {
          const cloudGen = await getCloudGeneration(uid);
          if (cloudGen === localGen) {
            // Cloud hasn't changed — skip download
            lastSyncedJsonRef.current = JSON.stringify(state);
            setSyncStatus('synced');
            return;
          }
          // Cloud is newer — download new data
          if (cloudGen !== null) {
            const cloudResult = await loadStateFromCloud(uid);
            if (cloudResult) {
              const merged = { ...defaultState, ...cloudResult.state };
              setState(merged);
              generationRef.current = cloudResult.generation;
              setLocalGeneration(cloudResult.generation);
              lastSyncedJsonRef.current = JSON.stringify(merged);
              setSyncStatus('synced');
              return;
            }
          }
        }

        // No local generation — fresh login or new account
        const cloudResult = await loadStateFromCloud(uid);

        if (cloudResult) {
          // Existing account — cloud is source of truth, silently download
          const merged = { ...defaultState, ...cloudResult.state };
          setState(merged);
          generationRef.current = cloudResult.generation;
          setLocalGeneration(cloudResult.generation);
          lastSyncedJsonRef.current = JSON.stringify(merged);
          setSyncStatus('synced');
        } else {
          // New account / no cloud data — upload local data to seed the cloud
          const gen = await saveStateToCloud(uid, state);
          generationRef.current = gen;
          setLocalGeneration(gen);
          lastSyncedJsonRef.current = JSON.stringify(state);
          setSyncStatus('synced');
        }
      } catch (err) {
        console.error('Cloud sync failed:', err);
        setSyncStatus('error');
      }
    })();
  }, [user, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve sync conflict
  const resolveSyncConflict = async (choice: 'upload' | 'download') => {
    if (!syncConflict || !user) return;

    try {
      setSyncStatus('syncing');

      if (choice === 'upload') {
        const gen = await saveStateToCloud(user.uid, state);
        generationRef.current = gen;
        setLocalGeneration(gen);
        lastSyncedJsonRef.current = JSON.stringify(state);
      } else {
        const cloudResult = await loadStateFromCloud(user.uid);
        if (cloudResult) {
          const merged = { ...defaultState, ...cloudResult.state };
          setState(merged);
          generationRef.current = cloudResult.generation;
          setLocalGeneration(cloudResult.generation);
          lastSyncedJsonRef.current = JSON.stringify(merged);
        }
      }

      setSyncStatus('synced');
    } catch (err) {
      console.error('Sync conflict resolution failed:', err);
      setSyncStatus('error');
    }

    setSyncConflict(null);
  };

  // Auto-sync to cloud on state changes (debounced 2.5s)
  useEffect(() => {
    if (!user) return;
    if (loading) return;
    if (syncStatus !== 'synced' && syncStatus !== 'pending') return;
    if (syncConflict) return;

    const json = JSON.stringify(state);
    if (json === lastSyncedJsonRef.current) return;

    // Local edits detected
    setSyncStatus('pending');

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        setSyncStatus('syncing');

        // Check if cloud generation still matches what we expect
        const cloudGen = await getCloudGeneration(user.uid);
        const expectedGen = generationRef.current;

        if (cloudGen !== null && expectedGen !== null && cloudGen !== expectedGen) {
          // Cloud has been updated by another device
          setSyncConflict({ type: 'upload' });
          setSyncStatus('pending');
          return;
        }

        // Safe to upload
        const newGen = await saveStateToCloud(user.uid, state);
        generationRef.current = newGen;
        setLocalGeneration(newGen);
        lastSyncedJsonRef.current = json;
        setSyncStatus('synced');
      } catch (err) {
        console.error('Cloud sync failed:', err);
        setSyncStatus('error');
      }
    }, 2500);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [state, user, loading, syncStatus, syncConflict]);

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
        const enabled: Record<string, boolean> = {};
        for (const h of holidays) {
          enabled[h.date] = h.enabled;
        }
        return { ...prev, holidays, enabledHolidays: enabled, extraDaysMonth: extraMonth, extraDaysCount: extraCount, advanceDays, maxTransferDays };
      }

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
    if (user) {
      generationRef.current = null;
      setLocalGeneration(null);
      lastSyncedJsonRef.current = '';
    }
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

  const value = {
    state, setState, toggleDate, toggleHoliday, initDefaults, addHoliday, resetState,
    holidayNames, dayStatuses, visibleYears, setHighlightedDate, calendarRef,
    syncStatus, syncConflict, resolveSyncConflict,
  };

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
