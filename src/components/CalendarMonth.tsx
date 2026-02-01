import { memo, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
} from 'date-fns';
import { formatMonthYear, DA_DAY_NAMES, toISODate } from '@/lib/dateUtils';
import { getFerieaarBalances } from '@/lib/vacationCalculations';
import { useVacation } from '@/context/VacationContext';
import { CalendarDay } from './CalendarDay';
import type { DayStatus } from '@/types';

interface CalendarMonthProps {
  month: Date;
  dayStatuses: Record<string, DayStatus>;
}

function DecemberExpirySubtitle({ year }: { year: number }) {
  const { state } = useVacation();
  // Ferieår that expires Dec 31 of this year is ferieår (year - 1)
  const expiringFerieaar = year - 1;
  const balances = getFerieaarBalances(
    state.startDate, state.initialVacationDays, state.extraDaysMonth,
    state.extraDaysCount, state.selectedDates, state.enabledHolidays,
    `${year + 1}-01-01`, state.maxTransferDays
  );
  const expiring = balances.find((b) => b.year === expiringFerieaar && b.expired);
  if (!expiring || expiring.lost <= 0) return null;
  return (
    <div className="text-xs text-red-600 text-center">
      {expiring.lost.toFixed(2)} feriedage overføres ikke
    </div>
  );
}

export const CalendarMonth = memo(function CalendarMonth({ month, dayStatuses }: CalendarMonthProps) {
  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);

  const startOffset = (getDay(startOfMonth(month)) + 6) % 7;
  const isDecember = month.getMonth() === 11;

  return (
    <div className="p-2">
      <h3 className="text-sm font-semibold mb-1 text-center">
        {formatMonthYear(month)}
      </h3>
      {isDecember && <DecemberExpirySubtitle year={month.getFullYear()} />}
      <div className="grid grid-cols-7 gap-x-3 gap-y-1.5">
        {DA_DAY_NAMES.map((name) => (
          <div
            key={name}
            className="w-8 h-6 text-xs text-muted-foreground flex items-center justify-center"
          >
            {name}
          </div>
        ))}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="w-8 h-8" />
        ))}
        {days.map((day) => {
          const dateStr = toISODate(day);
          return (
            <CalendarDay
              key={dateStr}
              dateStr={dateStr}
              dayOfMonth={day.getDate()}
              status={dayStatuses[dateStr] ?? 'normal'}
            />
          );
        })}
      </div>
    </div>
  );
});
