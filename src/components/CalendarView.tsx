import { useMemo, Fragment } from 'react';
import { generateMonths } from '@/lib/dateUtils';
import { useVacation } from '@/context/VacationContext';
import { CalendarMonth } from './CalendarMonth';
import { getFerieaarBalances } from '@/lib/vacationCalculations';

function YearSeparator({ year }: { year: number }) {
  const { state } = useVacation();

  // Ferieår that expires Dec 31 of this year is ferieår (year - 1)
  const expiringFerieaar = year - 1;
  const balances = getFerieaarBalances(
    state.startDate, state.initialVacationDays, state.extraDaysMonth,
    state.extraDaysCount, state.selectedDates, state.enabledHolidays,
    `${year + 1}-01-01`, state.maxTransferDays
  );
  const expiring = balances.find((b) => b.year === expiringFerieaar && b.expired);
  const lostDays = expiring?.lost ?? 0;

  // Find next ferieår to get actual transferred amount
  const nextFerieaar = balances.find((b) => b.year === expiringFerieaar + 1);
  const actualTransferred = nextFerieaar?.transferred ?? 0;

  let separatorText: React.ReactNode;
  if (actualTransferred === 0 && lostDays === 0) {
    // Nothing to transfer
    separatorText = (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        Ingen feriedage overføres til næste ferieår
      </span>
    );
  } else if (lostDays === 0) {
    // Some days transferred, none lost
    separatorText = (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {actualTransferred.toFixed(2)} feriedage overføres til næste ferieår
      </span>
    );
  } else {
    // Some days transferred, some lost
    separatorText = (
      <span className="text-xs whitespace-nowrap">
        <span className="text-muted-foreground">
          {actualTransferred.toFixed(2)} feriedage overføres til næste ferieår,{' '}
        </span>
        <span className="text-red-600 font-bold">{lostDays.toFixed(2)}</span>
        <span className="text-muted-foreground"> feriedage overføres ikke</span>
      </span>
    );
  }

  return (
    <div className="col-span-full flex items-center gap-2 py-4 text-muted-foreground">
      <div className="flex-1 border-t border-muted-foreground/30" />
      {separatorText}
      <div className="flex-1 border-t border-muted-foreground/30" />
    </div>
  );
}

export function CalendarView() {
  const { state, calendarRef, dayStatuses } = useVacation();
  const months = useMemo(() => generateMonths(state.yearRange), [state.yearRange]);

  return (
    <div ref={calendarRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 max-w-6xl">
      {months.map((m) => {
        const isDecember = m.getMonth() === 11;
        return (
          <Fragment key={m.toISOString()}>
            <CalendarMonth month={m} dayStatuses={dayStatuses} />
            {isDecember && <YearSeparator year={m.getFullYear()} />}
          </Fragment>
        );
      })}
    </div>
  );
}
