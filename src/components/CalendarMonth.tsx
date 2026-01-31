import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
} from 'date-fns';
import { formatMonthYear, DA_DAY_NAMES } from '@/lib/dateUtils';
import { CalendarDay } from './CalendarDay';

interface CalendarMonthProps {
  month: Date;
}

export function CalendarMonth({ month }: CalendarMonthProps) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });

  // Monday=0 offset: getDay returns 0=Sun, so Mon=0, Tue=1, ..., Sun=6
  const startOffset = (getDay(start) + 6) % 7;

  return (
    <div className="p-2">
      <h3 className="text-sm font-semibold mb-1 text-center">
        {formatMonthYear(month)}
      </h3>
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
        {days.map((day) => (
          <CalendarDay key={day.toISOString()} date={day} />
        ))}
      </div>
    </div>
  );
}
