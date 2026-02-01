import { useVacation } from '@/context/VacationContext';
import { getDayStatus, getBalance } from '@/lib/vacationCalculations';
import { toISODate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';

interface CalendarDayProps {
  date: Date;
}

const statusClasses: Record<string, string> = {
  'weekend': 'bg-gray-200 text-gray-500',
  'holiday': 'bg-blue-200 text-blue-800',
  'selected-ok': 'bg-green-300 text-green-900',
  'selected-warning': 'bg-yellow-300 text-yellow-900',
  'normal': 'hover:bg-gray-100',
};

function useTooltipText(dateStr: string, status: string): string {
  const { state, holidayNames } = useVacation();
  const dateLabel = format(new Date(dateStr + 'T00:00:00'), 'EEEE d. MMMM yyyy', { locale: da });

  switch (status) {
    case 'holiday':
      return `${dateLabel}\n${holidayNames[dateStr] ?? 'Helligdag'}`;
    case 'weekend':
      return `${dateLabel}\nWeekend`;
    case 'selected-ok': {
      const bal = getBalance(state.startDate, state.initialVacationDays, state.extraDaysMonth, state.extraDaysCount, state.selectedDates, state.enabledHolidays, dateStr);
      return `${dateLabel}\nFeriedag (saldo: ${bal.toFixed(1)})`;
    }
    case 'selected-warning': {
      const bal = getBalance(state.startDate, state.initialVacationDays, state.extraDaysMonth, state.extraDaysCount, state.selectedDates, state.enabledHolidays, dateStr);
      return `${dateLabel}\nFeriedag – ikke nok dage! (saldo: ${bal.toFixed(1)})`;
    }
    default:
      return dateLabel;
  }
}

export function CalendarDay({ date }: CalendarDayProps) {
  const { state, toggleDate } = useVacation();
  const dateStr = toISODate(date);

  const status = getDayStatus(
    dateStr,
    state.selectedDates,
    state.enabledHolidays,
    state.startDate,
    state.initialVacationDays,
    state.extraDaysMonth,
    state.extraDaysCount
  );

  const isHoliday = status === 'holiday';
  const tooltipText = useTooltipText(dateStr, status);

  function handleClick() {
    if (isHoliday) return;
    toggleDate(dateStr);
  }

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
          {date.getDate()}
        </button>
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-line text-xs">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}
