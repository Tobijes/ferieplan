import { useMemo } from 'react';
import { generateMonths } from '@/lib/dateUtils';
import { useVacation } from '@/context/VacationContext';
import { CalendarMonth } from './CalendarMonth';

export function CalendarView() {
  const { state, calendarRef } = useVacation();
  const months = useMemo(() => generateMonths(state.yearRange), [state.yearRange]);

  return (
    <div ref={calendarRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 max-w-5xl">
      {months.map((m) => (
        <CalendarMonth key={m.toISOString()} month={m} />
      ))}
    </div>
  );
}
