import { memo, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
} from 'date-fns';
import { da } from 'date-fns/locale';
import { DA_DAY_NAMES, toISODate } from '@/lib/dateUtils';
import { getVacationYearBalances } from '@/lib/vacationCalculations';
import { useVacation } from '@/context/VacationContext';
import { CalendarDay } from './CalendarDay';
import type { DayStatus } from '@/types';

interface CalendarMonthProps {
  month: Date;
  dayStatuses: Record<string, DayStatus>;
}

function formatVacationYearLabel(year: number): string {
  const y1 = year % 100;
  const y2 = (year + 1) % 100;
  return `${y1.toString().padStart(2, '0')}/${y2.toString().padStart(2, '0')}`;
}

function VacationYearBadge({ year, balance }: { year: number; balance: number }) {
  return (
    <span className="text-xs whitespace-nowrap">
      <span className="text-muted-foreground">{formatVacationYearLabel(year)}:</span>{' '}
      <span className="text-green-600 font-medium">{balance.toFixed(2)}</span>
    </span>
  );
}

function MonthHeader({ month }: { month: Date }) {
  const { state } = useVacation();
  const monthNum = month.getMonth(); // 0-indexed
  const year = month.getFullYear();
  const monthName = format(month, 'MMMM', { locale: da });

  // Calculate balances at end of month (earnedInVacationYear now credits days from start of month)
  const endOfMonthDate = toISODate(endOfMonth(month));
  const balances = getVacationYearBalances(
    state.startDate, state.initialVacationDays, state.extraDaysMonth,
    state.extraDaysCount, state.selectedDates, state.enabledHolidays,
    endOfMonthDate, state.maxTransferDays
  );

  // Determine active vacation year(s) for this month
  // Jan-Aug (0-7): Only vacation year (year - 1) is active
  // Sep-Dec (8-11): Both vacation year (year - 1) and vacation year (year) are active
  const isSepToDec = monthNum >= 8;

  const leftVacationYear = isSepToDec ? year - 1 : year - 1;
  const rightVacationYear = isSepToDec ? year : null;

  const leftBalance = balances.find(b => b.year === leftVacationYear && !b.expired);
  const rightBalance = rightVacationYear ? balances.find(b => b.year === rightVacationYear && !b.expired) : null;

  return (
    <div className="flex items-center justify-between mb-1 gap-1">
      <div className="flex-1 min-w-0">
        {leftBalance ? (
          <VacationYearBadge year={leftBalance.year} balance={leftBalance.balance} />
        ) : (
          <span className="text-xs text-transparent">--/--: 0.00</span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-center flex-shrink-0 capitalize">
        {monthName}
      </h3>
      <div className="flex-1 min-w-0 text-right">
        {rightBalance ? (
          <VacationYearBadge year={rightBalance.year} balance={rightBalance.balance} />
        ) : (
          <span className="text-xs text-transparent">--/--: 0.00</span>
        )}
      </div>
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

  return (
    <div className="p-2">
      <MonthHeader month={month} />
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
