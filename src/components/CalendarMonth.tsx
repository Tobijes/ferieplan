import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  getISOWeek,
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
      <span className={`${balance < 0 ? 'text-red-600' : balance === 0 ? 'text-muted-foreground' : 'text-green-600'} font-medium`}>{balance.toFixed(2)}</span>
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

export function CalendarMonth({ month, dayStatuses }: CalendarMonthProps) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });

  const startOffset = (getDay(start) + 6) % 7;

  // Build week rows for week number display
  const allCells: (Date | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...days,
  ];
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < allCells.length; i += 7) {
    weeks.push(allCells.slice(i, i + 7));
  }

  return (
    <div className="p-2">
      <MonthHeader month={month} />
      <div className="flex flex-col gap-y-1.5">
        {/* Day name header row */}
        <div className="flex">
          <div className="w-5 shrink-0" />
          <div className="grid grid-cols-7 gap-x-3 flex-1">
            {DA_DAY_NAMES.map((name) => (
              <div
                key={name}
                className="w-8 h-6 text-xs text-muted-foreground flex items-center justify-center"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
        {/* Week rows */}
        {weeks.map((week, weekIndex) => {
          const firstDay = week.find((d): d is Date => d !== null);
          const weekNum = firstDay ? getISOWeek(firstDay) : null;
          return (
            <div key={weekIndex} className="flex">
              <div className="w-5 shrink-0 h-8 flex items-center justify-end pr-1 text-[10px] text-muted-foreground/60">
                {weekNum}
              </div>
              <div className="grid grid-cols-7 gap-x-3 flex-1">
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return <div key={`empty-${dayIndex}`} className="w-8 h-8" />;
                  }
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
                {week.length < 7 &&
                  Array.from({ length: 7 - week.length }).map((_, i) => (
                    <div key={`pad-${i}`} className="w-8 h-8" />
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
