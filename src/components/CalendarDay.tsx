import { useVacation } from '@/context/VacationContext';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { da } from 'date-fns/locale';
import { toast } from 'sonner';
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

function formatHolidayDate(dateStr: string): string {
  const date = parseISO(dateStr);
  const formatted = format(date, "EEEE 'd.' d. MMMM", { locale: da });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function CalendarDay({ dateStr, dayOfMonth, status }: CalendarDayProps) {
  const { toggleDate, holidayNames } = useVacation();
  const isHoliday = status === 'holiday';
  const isBeforeStart = status === 'before-start';

  const handleClick = () => {
    if (isBeforeStart) return;
    if (isHoliday) {
      const name = holidayNames[dateStr];
      if (name) {
        toast(name, {
          description: formatHolidayDate(dateStr),
          duration: 3000,
        });
      }
      return;
    }
    toggleDate(dateStr);
  };

  return (
    <button
      data-date={dateStr}
      onClick={handleClick}
      disabled={isBeforeStart}
      className={cn(
        'w-8 h-8 rounded-full text-sm flex items-center justify-center transition-colors data-[highlighted=true]:ring-2 data-[highlighted=true]:ring-blue-500/60',
        statusClasses[status],
        isBeforeStart ? 'cursor-default' : 'cursor-pointer',
      )}
    >
      {dayOfMonth}
    </button>
  );
}
