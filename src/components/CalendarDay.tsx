import { memo, useCallback } from 'react';
import { useVacation } from '@/context/VacationContext';
import { getFerieaarBalances } from '@/lib/vacationCalculations';
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
  'before-start': 'opacity-30 cursor-default',
};

function BalanceLines({ dateStr }: { dateStr: string }) {
  const { state } = useVacation();
  const balances = getFerieaarBalances(
    state.startDate, state.initialVacationDays, state.extraDaysMonth,
    state.extraDaysCount, state.selectedDates, state.enabledHolidays, dateStr, state.maxTransferDays
  );
  const visible = balances.filter((b) => !b.expired && (b.earned + b.extra + b.transferred > 0 || b.balance !== 0));
  return (
    <>
      {visible.map((b) => (
        <span key={b.year}>{'\n'}Ferieåret {b.year}: {b.balance.toFixed(2)}</span>
      ))}
    </>
  );
}

function TooltipBody({ dateStr, status }: { dateStr: string; status: DayStatus }) {
  const { holidayNames } = useVacation();
  const dateLabel = format(new Date(dateStr + 'T00:00:00'), 'EEEE d. MMMM yyyy', { locale: da });

  switch (status) {
    case 'holiday':
      return <>{dateLabel}{'\n'}{holidayNames[dateStr] ?? 'Helligdag'}<BalanceLines dateStr={dateStr} /></>;
    case 'weekend':
      return <>{dateLabel}{'\n'}Weekend<BalanceLines dateStr={dateStr} /></>;
    case 'selected-ok':
      return <>{dateLabel}{'\n'}Feriedag<BalanceLines dateStr={dateStr} /></>;
    case 'selected-warning':
      return <>{dateLabel}{'\n'}Feriedag – forskudsferie<BalanceLines dateStr={dateStr} /></>;
    case 'selected-overdrawn':
      return <>{dateLabel}{'\n'}Feriedag – ikke nok dage!<BalanceLines dateStr={dateStr} /></>;
    default:
      return <>{dateLabel}<BalanceLines dateStr={dateStr} /></>;
  }
}

export const CalendarDay = memo(function CalendarDay({ dateStr, dayOfMonth, status }: CalendarDayProps) {
  const { toggleDate } = useVacation();
  const isDisabled = status === 'holiday' || status === 'before-start';

  const handleClick = useCallback(() => {
    if (isDisabled) return;
    toggleDate(dateStr);
  }, [isDisabled, toggleDate, dateStr]);

  const button = (
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

  if (status === 'before-start') return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {button}
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-line text-xs">
        <TooltipBody dateStr={dateStr} status={status} />
      </TooltipContent>
    </Tooltip>
  );
});
