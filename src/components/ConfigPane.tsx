import { useEffect, useMemo } from 'react';
import { useVacation } from '@/context/VacationContext';
import { useHolidays } from '@/hooks/useHolidays';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import { getVisibleYears } from '@/lib/dateUtils';
import type { YearRange } from '@/types';


const MONTH_NAMES = [
  'Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'December',
];

export function ConfigPane() {
  const { state, setState, toggleHoliday, initHolidays, resetState, setHighlightedDate } = useVacation();
  const holidays = useHolidays();

  useEffect(() => {
    if (holidays.length > 0) {
      const names: Record<string, string> = {};
      for (const h of holidays) {
        names[h.date] = h.name;
      }
      initHolidays(holidays.map((h) => h.date), names);
    }
  }, [holidays, initHolidays]);

  const visibleYears = useMemo(() => getVisibleYears(state.yearRange), [state.yearRange]);

  const holidaysByYear = useMemo(() => {
    const yearSet = new Set(visibleYears.map(String));
    const grouped: Record<string, typeof holidays> = {};
    for (const h of holidays) {
      const year = h.date.slice(0, 4);
      if (!yearSet.has(year)) continue;
      (grouped[year] ??= []).push(h);
    }
    return grouped;
  }, [holidays, visibleYears]);

  return (
    <div className="space-y-4 p-4 w-full lg:w-80 shrink-0">
      <Card>
        <CardHeader>
          <CardTitle>Indstillinger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="startDate">Startdato</Label>
            <Input
              id="startDate"
              type="date"
              value={state.startDate}
              onChange={(e) =>
                setState((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="initialDays">Feriedage ved start</Label>
            <Input
              id="initialDays"
              type="number"
              min={0}
              value={state.initialVacationDays}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  initialVacationDays: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Ekstra dage udbetales i</Label>
            <Select
              value={String(state.extraDaysMonth)}
              onValueChange={(v) =>
                setState((prev) => ({ ...prev, extraDaysMonth: Number(v) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Visning</Label>
            <Select
              value={state.yearRange}
              onValueChange={(v) =>
                setState((prev) => ({ ...prev, yearRange: v as YearRange }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Indeværende år</SelectItem>
                <SelectItem value="current+next">Indeværende + næste år</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Helligdage</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Accordion type="multiple" defaultValue={Object.keys(holidaysByYear)}>
            {Object.entries(holidaysByYear).map(([year, yearHolidays]) => (
              <AccordionItem key={year} value={year}>
                <AccordionTrigger className="px-6 py-3 text-sm">
                  {year}
                </AccordionTrigger>
                <AccordionContent className="px-6 space-y-2 pb-3">
                  {yearHolidays.map((h) => (
                    <Tooltip key={h.date}>
                      <TooltipTrigger asChild>
                        <div
                          className="flex items-center justify-between text-sm"
                          onMouseEnter={() => setHighlightedDate(h.date)}
                          onMouseLeave={() => setHighlightedDate(null)}
                        >
                          <span>{h.name}</span>
                          <Switch
                            checked={!!state.enabledHolidays[h.date]}
                            onCheckedChange={() => toggleHoliday(h.date)}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {format(new Date(h.date + 'T00:00:00'), 'EEEE d. MMMM yyyy', { locale: da })}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground hover:bg-red-100 hover:text-red-700"
              >
                Ryd alting
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                <AlertDialogDescription>
                  Dette sletter alle dine indstillinger, valgte feriedage og gemte data. Handlingen kan ikke fortrydes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuller</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={resetState}
                >
                  Ryd alting
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
