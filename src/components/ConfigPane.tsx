import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { useVacation } from '@/context/VacationContext';
import { useAuth } from '@/context/AuthContext';
import { useDefaults } from '@/hooks/useHolidays';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CircleCheck, CircleDot, CircleMinus, Loader2, LogIn, LogOut, PlusIcon, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoginDialog } from '@/components/LoginDialog';
import { toast } from 'sonner';
import type { SyncStatus } from '@/types';

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
import { HelpIcon } from '@/components/HelpIcon';


const SYNC_MESSAGES: Record<SyncStatus, string> = {
  disconnected: 'Ikke forbundet til skyen.',
  syncing: 'Synkroniserer med skyen...',
  synced: 'Alle ændringer er gemt i skyen.',
  pending: 'Lokale ændringer afventer synkronisering...',
  error: 'Synkronisering fejlede. Prøver igen ved næste ændring.',
};

function SyncStatusIcon({ status }: { status: SyncStatus }) {
  const handleClick = () => {
    toast(SYNC_MESSAGES[status], { duration: 3000 });
  };

  let icon: React.ReactNode;
  switch (status) {
    case 'disconnected':
      icon = <CircleMinus className="size-5 text-gray-400" />;
      break;
    case 'syncing':
      icon = <Loader2 className="size-5 text-gray-400 animate-spin" />;
      break;
    case 'synced':
      icon = <CircleCheck className="size-5 text-green-500" />;
      break;
    case 'pending':
      icon = <CircleDot className="size-5 text-yellow-500" />;
      break;
    case 'error':
      icon = <CircleMinus className="size-5 text-red-500" />;
      break;
  }

  return (
    <button onClick={handleClick} className="cursor-pointer p-1 -m-1">
      {icon}
    </button>
  );
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'December',
];

export function TopConfigBar({ onOpenDrawer }: { onOpenDrawer?: () => void }) {
  const { state, setState, initDefaults } = useVacation();
  const defaults = useDefaults();

  useEffect(() => {
    if (defaults.holidays.length > 0) {
      initDefaults(defaults.holidays, defaults.extraHoliday.defaultMonth, defaults.extraHoliday.defaultCount, defaults.advanceDays, defaults.maxTransferDays);
    }
  }, [defaults, initDefaults, state.holidays.length]);

  return (
    <div className="px-4 max-w-6xl w-full">
      {onOpenDrawer && (
        <Button
          variant="outline"
          size="icon"
          className="rounded-full shrink-0 mb-4"
          onClick={onOpenDrawer}
        >
          <Settings className="size-5" />
        </Button>
      )}
      <div className="flex items-end gap-2 max-w-lg mx-auto">
        <div className="flex-1 min-w-0 space-y-1">
          <Label htmlFor="initialDays">Optjente feriedage</Label>
          <div className="flex gap-2 items-center">
            <DeferredNumberInput
              id="initialDays"
              min={0}
              max={99}
              className="flex-1 min-w-0"
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
        <div className="flex-1 min-w-0 space-y-1">
          <Label htmlFor="startDate">Fra dato</Label>
          <div className="flex gap-2 items-center">
            <Input
              id="startDate"
              type="date"
              value={state.startDate}
              className="flex-1 min-w-0"
              onChange={(e) =>
                setState((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
            <HelpIcon text="Første dag hvor ferieplanen starter. Dage før denne dato kan ikke vælges." />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SidebarConfig() {
  const { state, setState, toggleHoliday, addHoliday, resetState, setHighlightedDate, visibleYears, syncStatus } = useVacation();
  const { user, logout } = useAuth();

  const yearSet = new Set(visibleYears.map(String));
  const holidaysByYear: Record<string, typeof state.holidays> = {};
  for (const h of state.holidays) {
    const year = h.date.slice(0, 4);
    if (!yearSet.has(year)) continue;
    (holidaysByYear[year] ??= []).push(h);
  }

  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Data
            {user && (
              <span className="text-xs text-muted-foreground font-normal truncate">
                {user.email || user.displayName || 'Bruger'}
              </span>
            )}
          </CardTitle>
          <CardAction>
            <SyncStatusIcon status={syncStatus} />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {user ? (
            <>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  className="flex-1 h-auto flex-col gap-1 py-3 cursor-pointer"
                  onClick={logout}
                >
                  <LogOut className="size-5" />
                  <span className="text-xs">Log ud</span>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 h-auto flex-col gap-1 py-3 cursor-pointer hover:bg-red-100 hover:text-red-700 hover:border-red-300"
                    >
                      <Trash2 className="size-5" />
                      <span className="text-xs">Ryd</span>
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
              </div>
            </>
          ) : (
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                className="flex-1 h-auto flex-col gap-1 py-3 cursor-pointer"
                onClick={() => setLoginOpen(true)}
              >
                <LogIn className="size-5" />
                <span className="text-xs">Log ind</span>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1 h-auto flex-col gap-1 py-3 cursor-pointer hover:bg-red-100 hover:text-red-700 hover:border-red-300"
                  >
                    <Trash2 className="size-5" />
                    <span className="text-xs">Ryd</span>
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
            </div>
          )}
          <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Indstillinger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Helligdage</CardTitle>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7 -mr-1">
                <PlusIcon className="size-4" />
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
        </CardHeader>
        <CardContent className="p-0">
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
      </Card>

    </div>
  );
}
