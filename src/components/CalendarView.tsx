import { Fragment } from 'react';
import { useVacation } from '@/context/VacationContext';
import { CalendarMonth } from './CalendarMonth';
import { Month } from '@/types/month';

function YearSeparator({ year }: { year: number }) {
  const { vacationBalances } = useVacation();

  const decemberMonth = new Month(year, 12);
  const lostDays = vacationBalances.lostDaysAccount.balanceAt(decemberMonth);
  const actualTransferred = vacationBalances.transferDaysAccount.balanceAt(decemberMonth);

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
      <span className="text-xs text-center">
        <span className="text-green-600 font-bold">{actualTransferred.toFixed(2)}</span>
        <span className="text-muted-foreground"> feriedage overføres til næste ferieår</span>
      </span>
    );
  } else {
    // Some days transferred, some lost
    separatorText = (
      <span className="text-xs text-center">
        <span className="text-green-600 font-bold">{actualTransferred.toFixed(2)}</span>
        <span className="text-muted-foreground"> feriedage overføres til næste ferieår, </span>
        <span className="text-red-600 font-bold">{lostDays.toFixed(2)}</span>
        <span className="text-muted-foreground"> feriedage overføres ikke</span>
      </span>
    );
  }

  return (
    <div className="col-span-full flex items-center gap-2 px-4 py-4 text-muted-foreground">
      <div className="flex-1 min-w-8 border-t border-muted-foreground/30" />
      {separatorText}
      <div className="flex-1 min-w-8 border-t border-muted-foreground/30" />
    </div>
  );
}

function YearHeader({ year }: { year: number }) {
  return (
    <div className="col-span-full pl-2">
      <h2 className="text-xl font-bold">{year}</h2>
    </div>
  );
}

export function CalendarView() {
  const { calendarRef, dayStatuses, months } = useVacation();

  return (
    <div ref={calendarRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-4 pb-4 max-w-6xl">
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
