# Ferieplan

Danish vacation day planner — client-side React app with no backend.

## Background: Danish Vacation System

- The "vacation obtain period" runs from 1 September Year 0 to 31 August Year 1.
- Vacation obtained in that period can be used from 1 September Year 0 through 31 December Year 1 (the "vacation usable period").
- Each month the employee earns 2.08 vacation days.
- At a configurable month, the employee receives 5 extra days ("6. ferieuge").
- Public holidays are automatically free and do not consume vacation days.
- Holiday data is pre-populated in `public/data.json` for 2025–2027 (Nytårsdag, Skærtorsdag, Langfredag, Påskedag, 2. påskedag, Kristi himmelfartsdag, Pinsedag, 2. pinsedag, Grundlovsdag, 1. juledag, 2. juledag). Extend this file to add more years.

## Tech Stack

- Vite + React 19 + TypeScript (strict mode)
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin) + shadcn/ui (new-york style)
- date-fns with `da` locale for all date formatting
- localStorage for state persistence
- Path alias: `@/` → `src/`

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build (runs `tsc -b && vite build`)
- `npx tsc --noEmit` — type check without build

## Project Structure

```
src/
├── components/
│   ├── ui/                # shadcn components (accordion, button, card, input, label, scroll-area, select, switch, tooltip)
│   ├── App.tsx            # Root: VacationProvider + TooltipProvider + 2-column layout
│   ├── ConfigPane.tsx     # Left pane: settings, year range dropdown, holiday toggles (accordion by year)
│   ├── CalendarView.tsx   # Right pane: scrollable grid of months based on yearRange
│   ├── CalendarMonth.tsx  # Single month: header + 7-col day grid (Mon–Sun)
│   └── CalendarDay.tsx    # Day cell: colored circle + tooltip on hover
├── context/
│   └── VacationContext.tsx # Global state with localStorage persistence
├── hooks/
│   ├── useHolidays.ts     # Fetches public/data.json
│   └── useLocalStorage.ts # Generic localStorage hook
├── lib/
│   ├── utils.ts           # cn() helper (shadcn)
│   ├── dateUtils.ts       # DA_DAY_NAMES, formatMonthYear, generateMonths, getVisibleYears, toISODate
│   └── vacationCalculations.ts  # Balance logic, day status determination
├── types/
│   └── index.ts           # Holiday, VacationState, YearRange, DayStatus
├── main.tsx
└── index.css              # Tailwind imports + CSS variables (light theme only)
public/
└── data.json              # Danish holidays 2025–2027
```

## State Shape (persisted to localStorage as `ferieplan-state`)

```ts
interface VacationState {
  startDate: string;              // ISO date, default: today
  initialVacationDays: number;    // days available at start, default: 0
  extraDaysMonth: number;         // 1–12, month when 5 extra days granted, default: 5 (May)
  yearRange: 'current' | 'current+next';  // calendar display range, default: 'current'
  selectedDates: string[];        // ISO dates user picked as vacation
  enabledHolidays: Record<string, boolean>; // holiday date → enabled
}
```

## Vacation Calculation Logic

1. From `startDate`, each elapsed month earns 2.08 days
2. In the configured `extraDaysMonth`, 5 extra days are added (per year)
3. Selected dates (excluding enabled holidays) count as used days
4. Balance = initialDays + earned + extra − used
5. A selected day is **green** if balance ≥ 0 after counting it; **yellow** if balance < 0

## Day Status Colors

| Status | Color | Behavior |
|--------|-------|----------|
| Weekend (Sat/Sun) | Gray | Selectable |
| Enabled holiday | Blue | Not selectable (auto-free) |
| Selected, balance ≥ 0 | Green | Toggle off by clicking |
| Selected, balance < 0 | Yellow | Toggle off by clicking |
| Normal weekday | No circle | Selectable |

## Key Behaviors

- All dates have tooltips on hover showing full Danish date + status reason
- Holidays in config pane show date tooltip on hover and highlight the corresponding calendar day with a blue ring
- Holidays are grouped by year in an accordion, filtered to only show years visible in the calendar
- Calendar view has `max-w-5xl` to prevent stretching on wide monitors
- Year range selector: "Indeværende år" (12 months) or "Indeværende + næste år" (24 months)
- State survives page refresh via localStorage
- `holidayNames` map is held in context (non-persisted) for tooltip lookups
- `highlightedDate` in context drives the calendar highlight ring on holiday hover
- Context functions (`toggleDate`, `toggleHoliday`, `initHolidays`) are wrapped in `useCallback` to avoid infinite re-render loops

## Locale

All UI text is in Danish. Day names: Man, Tir, Ons, Tor, Fre, Lør, Søn. Month names and date formatting use `date-fns/locale/da`.
