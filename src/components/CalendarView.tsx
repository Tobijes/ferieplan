import { Fragment } from 'react';
import { generateMonths } from '@/lib/dateUtils';
import { useVacation } from '@/context/VacationContext';
import { CalendarMonth } from './CalendarMonth';
import { getVacationYearBalances } from '@/lib/vacationCalculations';

function YearSeparator({ year }: { year: number }) {
  const { state } = useVacation();

  // Vacation year that expires Dec 31 of this year is vacation year (year - 1)
  const expiringVacationYear = year - 1;
  const balances = getVacationYearBalances(
    state.startDate, state.initialVacationDays, state.extraDaysMonth,
    state.extraDaysCount, state.selectedDates, state.enabledHolidays,
    `${year + 1}-01-01`, state.maxTransferDays
  );
  const expiring = balances.find((b) => b.year === expiringVacationYear && b.expired);
  const lostDays = expiring?.lost ?? 0;

  // Find next vacation year to get actual transferred amount
  const nextVacationYear = balances.find((b) => b.year === expiringVacationYear + 1);
  const actualTransferred = nextVacationYear?.transferred ?? 0;

  let separatorText: React.ReactNode;
  if (actualTransferred === 0 && lostDays === 0) {
    // Nothing to transfer
    separatorText = (
      <span className="text-xs text-muted-foreground text-center">
        Ingen feriedage overføres til næste ferieår
      </span>
    );
  } else if (lostDays === 0) {
    // Some days transferred, none lost
    separatorText = (
      <span className="text-xs text-muted-foreground text-center">
        {actualTransferred.toFixed(2)} feriedage overføres til næste ferieår
      </span>
    );
  } else {
    // Some days transferred, some lost
    separatorText = (
      <span className="text-xs text-center">
        <span className="text-muted-foreground">
          {actualTransferred.toFixed(2)} feriedage overføres til næste ferieår,{' '}
        </span>
        <span className="text-red-600 font-bold">{lostDays.toFixed(2)}</span>
        <span className="text-muted-foreground"> feriedage overføres ikke</span>
      </span>
    );
  }

  return (
    <div className="col-span-full flex items-center gap-2 px-4 py-4 text-muted-foreground">
      <div className="shrink-0 flex-1 border-t border-muted-foreground/30" />
      {separatorText}
      <div className="shrink-0 flex-1 border-t border-muted-foreground/30" />
    </div>
  );
}

function YearHeader({ year }: { year: number }) {
  return (
    <div className="col-span-full pl-2 pt-2">
      <h2 className="text-xl font-bold">{year}</h2>
    </div>
  );
}

export function CalendarView() {
  const { state, calendarRef, dayStatuses } = useVacation();
  const months = generateMonths(state.yearRange);

  return (
    <div ref={calendarRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 max-w-6xl">
      {months.map((m) => {
        const isJanuary = m.getMonth() === 0;
        const isDecember = m.getMonth() === 11;
        return (
          <Fragment key={m.toISOString()}>
            {isJanuary && <YearHeader year={m.getFullYear()} />}
            <CalendarMonth month={m} dayStatuses={dayStatuses} />
            {isDecember && <YearSeparator year={m.getFullYear()} />}
          </Fragment>
        );
      })}
    </div>
  );
}
