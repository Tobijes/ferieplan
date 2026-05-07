import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  getISOWeek,
  format,
  parseISO,
} from "date-fns";
import { da } from "date-fns/locale";
import { Info } from "lucide-react";
import { DA_DAY_NAMES, toISODate } from "@/lib/dateUtils";
import { useVacation } from "@/context/VacationContext";
import { Month } from "@/types/month";
import { CalendarDay } from "./CalendarDay";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DayStatus } from "@/types";

interface CalendarMonthProps {
  month: Date;
  dayStatuses: Record<string, DayStatus>;
}


function balanceColor(balance: number, advanceDays: number): string {
  if (balance > 0) return "text-green-600";
  if (balance === 0) return "text-muted-foreground";
  if (balance >= -advanceDays) return "text-yellow-500";
  return "text-red-600";
}

interface BreakdownRow {
  label: string;
  balance: number;
}

function BalanceDetailsPopover({
  rows,
  advanceDays,
}: {
  rows: BreakdownRow[];
  advanceDays: number;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center shrink-0 text-muted-foreground/40 hover:text-muted-foreground"
        >
          <Info className="w-5 h-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="text-xs w-auto p-2">
        <div className="flex flex-col gap-1">
          <div className="font-bold whitespace-nowrap">
            Feriedage fordelt på
          </div>
          {rows.map((row, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 whitespace-nowrap"
            >
              <span className="text-muted-foreground">{row.label}:</span>
              <span
                className={`${balanceColor(row.balance, advanceDays)} font-medium`}
              >
                {row.balance.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MonthHeader({ month }: { month: Date }) {
  const { state, vacationBalances } = useVacation();
  const monthName = format(month, "MMMM", { locale: da });

  const employmentMonthStart = startOfMonth(parseISO(state.startDate));
  const monthEnd = endOfMonth(month);
  const isBeforeStart = monthEnd < employmentMonthStart;

  if (isBeforeStart) {
    return (
      <div className="relative flex flex-col items-center justify-center mb-2">
        <h3 className="text-sm font-semibold capitalize">{monthName}</h3>
      </div>
    );
  }

  const calMonth = new Month(month.getFullYear(), month.getMonth() + 1);

  const activeVacationAccounts = vacationBalances.vacationAccounts.filter(
    (acc) => acc.has(calMonth),
  );
  const activeExtraAccounts = vacationBalances.extraDaysAccounts.filter(
    (acc) => acc.has(calMonth),
  );

  const breakdownRows: BreakdownRow[] = [];
  for (const acc of activeVacationAccounts) {
    breakdownRows.push({ label: acc.name, balance: acc.balanceAt(calMonth) });
  }
  const extraBalance = activeExtraAccounts.reduce(
    (sum, acc) => sum + acc.balanceAt(calMonth),
    0,
  );
  if (vacationBalances.extraDaysAccounts.length > 0) {
    breakdownRows.push({ label: "Feriefridage", balance: extraBalance });
  }

  const totalBalance = breakdownRows.reduce((sum, r) => sum + r.balance, 0);

  const boughtDays = vacationBalances.boughtDaysAccount.balanceAt(calMonth);

  return (
    <div className="relative flex flex-col items-center justify-center mb-2">
      <h3 className="text-sm font-semibold capitalize">{monthName}</h3>
      <div className="flex items-center gap-1 mt-0.5 text-xs whitespace-nowrap">
        <span className="text-muted-foreground">Feriedage:</span>{" "}
        <span
          className={`${balanceColor(totalBalance, state.advanceDays)} font-medium`}
        >
          {totalBalance.toFixed(2)}
        </span>
        {boughtDays > 0 && (
          <span className="text-muted-foreground">
            {"- Mangler: "}
            <span className="text-red-600 font-medium">
              {boughtDays.toFixed(2)}
            </span>
            
          </span>
        )}
      </div>
      {breakdownRows.length > 0 && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <BalanceDetailsPopover
            rows={breakdownRows}
            advanceDays={state.advanceDays}
          />
        </div>
      )}
    </div>
  );
}

export function CalendarMonth({ month, dayStatuses }: CalendarMonthProps) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });

  const startOffset = (getDay(start) + 6) % 7;

  // Build week rows for week number display
  const allCells: (Date | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...days,
  ];
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < allCells.length; i += 7) {
    weeks.push(allCells.slice(i, i + 7));
  }

  return (
    <div className="p-2">
      <MonthHeader month={month} />
      <div className="flex flex-col gap-y-1.5">
        {/* Day name header row */}
        <div className="flex">
          <div className="w-5 shrink-0" />
          <div className="grid grid-cols-7 gap-x-3 flex-1">
            {DA_DAY_NAMES.map((name) => (
              <div
                key={name}
                className="w-8 h-6 text-xs text-muted-foreground flex items-center justify-center"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
        {/* Week rows */}
        {weeks.map((week, weekIndex) => {
          const firstDay = week.find((d): d is Date => d !== null);
          const weekNum = firstDay ? getISOWeek(firstDay) : null;
          return (
            <div key={weekIndex} className="flex">
              <div className="w-5 shrink-0 h-8 flex items-center justify-end pr-1 text-[10px] text-muted-foreground/60">
                {weekNum}
              </div>
              <div className="grid grid-cols-7 gap-x-3 flex-1">
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return (
                      <div key={`empty-${dayIndex}`} className="w-8 h-8" />
                    );
                  }
                  const dateStr = toISODate(day);
                  return (
                    <CalendarDay
                      key={dateStr}
                      dateStr={dateStr}
                      dayOfMonth={day.getDate()}
                      status={dayStatuses[dateStr] ?? "normal"}
                    />
                  );
                })}
                {week.length < 7 &&
                  Array.from({ length: 7 - week.length }).map((_, i) => (
                    <div key={`pad-${i}`} className="w-8 h-8" />
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
