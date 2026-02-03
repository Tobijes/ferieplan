import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { useVacation, defaultState } from '@/context/VacationContext';
import { useDefaults } from '@/hooks/useHolidays';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDownIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function DeferredNumberInput({ value, onCommit, ...props }: Omit<ComponentProps<typeof Input>, 'onChange' | 'onBlur' | 'value'> & { value: number; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  const pointerDown = useRef(false);
  useEffect(() => { setLocal(String(value)); }, [value]);
  const clamp = (v: number) => Math.max(Number(props.min ?? -Infinity), Math.min(v, Number(props.max ?? Infinity)));
  return (
    <Input
      {...props}
      type="number"
      value={local}
      onPointerDown={() => { pointerDown.current = true; }}
      onChange={(e) => {
        const raw = e.target.value;
        setLocal(raw);
        // Spinner buttons trigger via pointer — commit immediately
        if (pointerDown.current) {
          pointerDown.current = false;
          onCommit(clamp(Number(raw)));
        }
      }}
      onBlur={() => onCommit(clamp(Number(local)))}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import { getVisibleYears } from '@/lib/dateUtils';
import type { VacationState, YearRange } from '@/types';
import { HelpIcon } from '@/components/HelpIcon';
import { cn } from '@/lib/utils';


const MONTH_NAMES = [
  'Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'December',
];

export function ConfigPane() {
  const { state, setState, toggleHoliday, initDefaults, addHoliday, resetState, setHighlightedDate } = useVacation();
  const defaults = useDefaults();

  useEffect(() => {
    if (defaults.holidays.length > 0) {
      initDefaults(defaults.holidays, defaults.extraHoliday.defaultMonth, defaults.extraHoliday.defaultCount, defaults.advanceDays, defaults.maxTransferDays);
    }
  }, [defaults, initDefaults, state.holidays.length]);

  const visibleYears = useMemo(() => getVisibleYears(state.yearRange), [state.yearRange]);

  const holidaysByYear = useMemo(() => {
    const yearSet = new Set(visibleYears.map(String));
    const grouped: Record<string, typeof state.holidays> = {};
    for (const h of state.holidays) {
      const year = h.date.slice(0, 4);
      if (!yearSet.has(year)) continue;
      (grouped[year] ??= []).push(h);
    }
    return grouped;
  }, [state.holidays, visibleYears]);

  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<VacationState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collapsible card states - responsive defaults
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const initializedRef = useRef(false);
  const [optjentFerieOpen, setOptjentFerieOpen] = useState(true);
  const [indstillingerOpen, setIndstillingerOpen] = useState(true);
  const [helligdageOpen, setHelligdageOpen] = useState(true);
  const [dataOpen, setDataOpen] = useState(true);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (!isDesktop) {
        // On mobile: only first card expanded
        setIndstillingerOpen(false);
        setHelligdageOpen(false);
        setDataOpen(false);
      }
    }
  }, [isDesktop]);

  function handleAddHoliday() {
    if (!newHolidayDate || !newHolidayName.trim()) return;
    addHoliday(newHolidayDate, newHolidayName.trim());
    setNewHolidayDate('');
    setNewHolidayName('');
    setPopoverOpen(false);
  }

  return (
    <div className="space-y-4 p-4 w-full lg:w-80 shrink-0">
      <Card>
        <Collapsible open={optjentFerieOpen} onOpenChange={setOptjentFerieOpen}>
          <CardHeader
            onClick={() => setOptjentFerieOpen(!optjentFerieOpen)}
            className="flex flex-row items-center justify-between select-none transition-colors cursor-pointer hover:bg-muted/50"
          >
            <CardTitle>Optjent ferie</CardTitle>
            <ChevronDownIcon className={cn("size-4 text-muted-foreground shrink-0 transition-transform duration-200", optjentFerieOpen && "rotate-180")} />
          </CardHeader>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1">
                <Label htmlFor="startDate">Startdato</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="startDate"
                    type="date"
                    value={state.startDate}
                    className="flex-1"
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                  />
                  <HelpIcon text="Første dag hvor ferieplanen starter. Dage før denne dato kan ikke vælges." />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="initialDays">Feriedage ved start</Label>
                <div className="flex gap-2 items-center">
                  <DeferredNumberInput
                    id="initialDays"
                    min={0}
                    max={99}
                    className="flex-1"
                    value={state.initialVacationDays}
                    onCommit={(v) =>
                      setState((prev) => ({
                        ...prev,
                        initialVacationDays: v,
                      }))
                    }
                  />
                  <HelpIcon text="Antal feriedage du allerede har optjent ved startdatoen." />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card>
        <Collapsible open={indstillingerOpen} onOpenChange={setIndstillingerOpen}>
          <CardHeader
            onClick={() => setIndstillingerOpen(!indstillingerOpen)}
            className="flex flex-row items-center justify-between select-none transition-colors cursor-pointer hover:bg-muted/50"
          >
            <CardTitle>Indstillinger</CardTitle>
            <ChevronDownIcon className={cn("size-4 text-muted-foreground shrink-0 transition-transform duration-200", indstillingerOpen && "rotate-180")} />
          </CardHeader>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1">
                <div className="flex gap-2 items-end">
                  <div className="grow-[3] basis-0 min-w-0 space-y-1">
                    <Label>Ekstra feriedage</Label>
                    <DeferredNumberInput
                      min={0}
                      max={99}
                      value={state.extraDaysCount}
                      onCommit={(v) =>
                        setState((prev) => ({ ...prev, extraDaysCount: v }))
                      }
                    />
                  </div>
                  <div className="grow-[2] basis-0 min-w-0 space-y-1">
                    <Label>Tildeles i</Label>
                    <Select
                      value={String(state.extraDaysMonth)}
                      onValueChange={(v) =>
                        setState((prev) => ({ ...prev, extraDaysMonth: Number(v) }))
                      }
                    >
                      <SelectTrigger className="w-full">
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
                  <div className="h-9 flex items-center">
                    <HelpIcon text="Ekstra feriedage (f.eks. 6. ferieuge) og hvilken måned de tildeles." />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="advanceDays">Forskudsferie</Label>
                <div className="flex gap-2 items-center">
                  <DeferredNumberInput
                    id="advanceDays"
                    min={0}
                    max={99}
                    className="flex-1"
                    value={state.advanceDays}
                    onCommit={(v) =>
                      setState((prev) => ({
                        ...prev,
                        advanceDays: v,
                      }))
                    }
                  />
                  <HelpIcon text="Antal dage du må låne på forskud, før de er optjent." />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxTransferDays">Overførbare feriedage</Label>
                <div className="flex gap-2 items-center">
                  <DeferredNumberInput
                    id="maxTransferDays"
                    min={0}
                    max={99}
                    className="flex-1"
                    value={state.maxTransferDays}
                    onCommit={(v) =>
                      setState((prev) => ({
                        ...prev,
                        maxTransferDays: v,
                      }))
                    }
                  />
                  <HelpIcon text="Maks antal ubrugte feriedage der kan overføres til næste ferieår." />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Visning</Label>
                <div className="flex gap-2 items-center">
                  <Select
                    value={state.yearRange}
                    onValueChange={(v) =>
                      setState((prev) => ({ ...prev, yearRange: v as YearRange }))
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Indeværende år</SelectItem>
                      <SelectItem value="current+next">Indeværende + næste år</SelectItem>
                    </SelectContent>
                  </Select>
                  <HelpIcon text="Vælg om kalenderen viser indeværende år eller også næste år." />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card>
        <Collapsible open={helligdageOpen} onOpenChange={setHelligdageOpen}>
          <CardHeader
            onClick={() => setHelligdageOpen(!helligdageOpen)}
            className="flex flex-row items-center justify-between select-none transition-colors cursor-pointer hover:bg-muted/50"
          >
            <CardTitle>Helligdage</CardTitle>
            <ChevronDownIcon className={cn("size-4 text-muted-foreground shrink-0 transition-transform duration-200", helligdageOpen && "rotate-180")} />
          </CardHeader>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <CardContent className="p-0">
              <div className="px-6 pt-4 pb-3">
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <PlusIcon className="size-4 mr-2" />
                      Tilføj helligdag
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="newHolidayName">Navn</Label>
                      <Input
                        id="newHolidayName"
                        value={newHolidayName}
                        onChange={(e) => setNewHolidayName(e.target.value)}
                        placeholder="f.eks. Grundlovsdag"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="newHolidayDate">Dato</Label>
                      <Input
                        id="newHolidayDate"
                        type="date"
                        value={newHolidayDate}
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                      />
                    </div>
                    <Button size="sm" className="w-full" onClick={handleAddHoliday} disabled={!newHolidayDate || !newHolidayName.trim()}>
                      Tilføj
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>
              <Accordion type="multiple" defaultValue={[String(new Date().getFullYear())]}>
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
                              className="flex items-center justify-between text-sm cursor-pointer select-none hover:bg-muted rounded-md px-1 -mx-1"
                              onMouseEnter={() => setHighlightedDate(h.date)}
                              onMouseLeave={() => setHighlightedDate(null)}
                              onClick={() => toggleHoliday(h.date)}
                            >
                              <span>{h.name}</span>
                              <div onClick={(e) => e.stopPropagation()}>
                                <Switch
                                  checked={!!state.enabledHolidays[h.date]}
                                  onCheckedChange={() => toggleHoliday(h.date)}
                                />
                              </div>
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
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card>
        <Collapsible open={dataOpen} onOpenChange={setDataOpen}>
          <CardHeader
            onClick={() => setDataOpen(!dataOpen)}
            className="flex flex-row items-center justify-between select-none transition-colors cursor-pointer hover:bg-muted/50"
          >
            <CardTitle>Data</CardTitle>
            <ChevronDownIcon className={cn("size-4 text-muted-foreground shrink-0 transition-transform duration-200", dataOpen && "rotate-180")} />
          </CardHeader>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <CardContent className="space-y-2 pt-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'ferieplan.json';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Gem plan
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                Indlæs plan
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    try {
                      const data = { ...defaultState, ...JSON.parse(reader.result as string) };
                      setPendingImport(data);
                      setImportDialogOpen(true);
                    } catch {
                      alert('Ugyldig JSON-fil.');
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
              <AlertDialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Indlæs plan?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Dette erstatter alle dine nuværende indstillinger og valgte feriedage med data fra filen. Handlingen kan ikke fortrydes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setPendingImport(null)}>Annuller</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {
                      if (pendingImport) {
                        setState(pendingImport);
                        setPendingImport(null);
                      }
                    }}>
                      Indlæs
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full hover:bg-red-100 hover:text-red-700 hover:border-red-300"
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
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
