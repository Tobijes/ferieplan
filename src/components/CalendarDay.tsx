import { memo, useCallback } from 'react';
import { useVacation } from '@/context/VacationContext';
import { cn } from '@/lib/utils';
import type { DayStatus } from '@/types';

interface CalendarDayProps {
  dateStr: string;
  dayOfMonth: number;
  status: DayStatus;
}

const statusClasses: Record<string, string> = {
  'weekend': 'bg-gray-200 text-gray-500',
  'holiday': 'bg-blue-200 text-blue-800',
  'selected-ok': 'bg-green-300 text-green-900',
  'selected-warning': 'bg-yellow-300 text-yellow-900',
  'selected-overdrawn': 'bg-red-300 text-red-900',
  'normal': 'hover:bg-gray-100',
  'before-start': 'opacity-30 cursor-default',
};

export const CalendarDay = memo(function CalendarDay({ dateStr, dayOfMonth, status }: CalendarDayProps) {
  const { toggleDate } = useVacation();
  const isDisabled = status === 'holiday' || status === 'before-start';

  const handleClick = useCallback(() => {
    if (isDisabled) return;
    toggleDate(dateStr);
  }, [isDisabled, toggleDate, dateStr]);

  return (
    <button
      data-date={dateStr}
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(
        'w-8 h-8 rounded-full text-sm flex items-center justify-center transition-colors data-[highlighted=true]:ring-2 data-[highlighted=true]:ring-blue-500/60',
        statusClasses[status],
        isDisabled ? 'cursor-default' : 'cursor-pointer',
      )}
    >
      {dayOfMonth}
    </button>
  );
});
