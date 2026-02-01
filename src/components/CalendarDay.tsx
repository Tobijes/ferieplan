import { memo, useCallback } from 'react';
import { useVacation } from '@/context/VacationContext';
import { getBalance } from '@/lib/vacationCalculations';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
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
};

function TooltipBody({ dateStr, status }: { dateStr: string; status: DayStatus }) {
  const { state, holidayNames } = useVacation();
  const dateLabel = format(new Date(dateStr + 'T00:00:00'), 'EEEE d. MMMM yyyy', { locale: da });
  const bal = getBalance(state.startDate, state.initialVacationDays, state.extraDaysMonth, state.extraDaysCount, state.selectedDates, state.enabledHolidays, dateStr);

  switch (status) {
    case 'holiday':
      return <>{dateLabel}{'\n'}{holidayNames[dateStr] ?? 'Helligdag'}{'\n'}Saldo: {bal.toFixed(1)}</>;
    case 'weekend':
      return <>{dateLabel}{'\n'}Weekend{'\n'}Saldo: {bal.toFixed(1)}</>;
    case 'selected-ok':
      return <>{dateLabel}{'\n'}Feriedag{'\n'}Saldo: {bal.toFixed(1)}</>;
    case 'selected-warning':
      return <>{dateLabel}{'\n'}Feriedag – forskudsferie{'\n'}Saldo: {bal.toFixed(1)}</>;
    case 'selected-overdrawn':
      return <>{dateLabel}{'\n'}Feriedag – ikke nok dage!{'\n'}Saldo: {bal.toFixed(1)}</>;
    default:
      return <>{dateLabel}{'\n'}Saldo: {bal.toFixed(1)}</>;
  }
}

export const CalendarDay = memo(function CalendarDay({ dateStr, dayOfMonth, status }: CalendarDayProps) {
  const { toggleDate } = useVacation();
  const isHoliday = status === 'holiday';

  const handleClick = useCallback(() => {
    if (isHoliday) return;
    toggleDate(dateStr);
  }, [isHoliday, toggleDate, dateStr]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          data-date={dateStr}
          onClick={handleClick}
          disabled={isHoliday}
          className={cn(
            'w-8 h-8 rounded-full text-sm flex items-center justify-center transition-colors data-[highlighted=true]:ring-2 data-[highlighted=true]:ring-blue-500/60',
            statusClasses[status],
            isHoliday && 'cursor-default',
          )}
        >
          {dayOfMonth}
        </button>
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-line text-xs">
        <TooltipBody dateStr={dateStr} status={status} />
      </TooltipContent>
    </Tooltip>
  );
});
