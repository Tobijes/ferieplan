# Ferieplan

Danish vacation day planner — client-side React app with no backend.

## Background: Danish Vacation System

- The "vacation obtain period" runs from 1 September Year 0 to 31 August Year 1.
- Vacation obtained in that period can be used from 1 September Year 0 through 31 December Year 1 (the "vacation usable period").
- Each month the employee earns 2.08 vacation days.
- At a configurable month, the employee receives a configurable number of extra days ("6. ferieuge", default 5).
- Public holidays are automatically free and do not consume vacation days.
- "Forskudsferie" (advance vacation) allows borrowing a configurable number of days before they are earned. Default 0, seeded from `default.json`.
- Default holiday data lives in `public/default.json` for 2026–2027. This file seeds the user's holiday list on first load (or after reset). Each holiday has a `date`, `name`, and `enabled` boolean.
- The user can add custom holidays via a popover (+) button in the Helligdage card header.
- Holidays (including user-added ones) are persisted in `state.holidays` in localStorage, not re-fetched from the JSON on every load.

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
│   ├── ui/                # shadcn components (accordion, alert-dialog, button, card, input, label, popover, scroll-area, select, switch, tooltip)
│   ├── App.tsx            # Root: VacationProvider + TooltipProvider + 2-column layout
│   ├── ConfigPane.tsx     # Left pane: settings, holiday toggles (accordion by year), data management (reset)
│   ├── CalendarView.tsx   # Right pane: scrollable grid of months based on yearRange
│   ├── CalendarMonth.tsx  # Single month: header + 7-col day grid (Mon–Sun)
│   └── CalendarDay.tsx    # Day cell: colored circle + tooltip on hover
├── context/
│   └── VacationContext.tsx # Global state with localStorage persistence
├── hooks/
│   ├── useHolidays.ts     # useDefaults() — fetches public/default.json (DefaultData)
│   └── useLocalStorage.ts # Generic localStorage hook
├── lib/
│   ├── utils.ts           # cn() helper (shadcn)
│   ├── dateUtils.ts       # DA_DAY_NAMES, formatMonthYear, generateMonths, getVisibleYears, toISODate
│   └── vacationCalculations.ts  # Balance logic, day status determination
├── types/
│   └── index.ts           # Holiday, DefaultData, VacationState, YearRange, DayStatus
├── main.tsx
└── index.css              # Tailwind imports + CSS variables (light theme only)
public/
└── default.json           # Default holidays 2026–2027 + extraHoliday config
```

## State Shape (persisted to localStorage as `ferieplan-state`)

```ts
interface VacationState {
  startDate: string;              // ISO date, default: 1st of current month
  initialVacationDays: number;    // days available at start, default: 0
  extraDaysMonth: number;         // 1–12, month when extra days granted, default: 5 (May)
  extraDaysCount: number;         // number of extra days granted, default: 5
  yearRange: 'current' | 'current+next';  // calendar display range, default: 'current'
  selectedDates: string[];        // ISO dates user picked as vacation
  enabledHolidays: Record<string, boolean>; // holiday date → enabled
  holidays: Holiday[];            // full holiday list (persisted, seeded from default.json)
  advanceDays: number;            // max borrowable vacation days (forskudsferie), default: 0
}

interface Holiday {
  date: string;    // ISO date
  name: string;    // Danish name
  enabled: boolean; // default enabled state (used when seeding)
}
```

## Vacation Calculation Logic

1. From `startDate`, each elapsed month earns 2.08 days
2. In the configured `extraDaysMonth`, `extraDaysCount` extra days are added (per year)
3. Selected dates (excluding enabled holidays) count as used days
4. Balance = initialDays + earned + extra − used
5. A selected day is **green** if balance ≥ 0; **yellow** if balance < 0 but ≥ −advanceDays (borrowed/forskudsferie); **red** if balance < −advanceDays (overdrawn)

## Day Status Colors

| Status | Color | Behavior |
|--------|-------|----------|
| Weekend (Sat/Sun) | Gray | Selectable |
| Enabled holiday | Blue | Not selectable (auto-free) |
| Selected, balance ≥ 0 | Green | Toggle off by clicking |
| Selected, balance < 0 but ≥ −advanceDays | Yellow | Borrowed days (forskudsferie), toggle off by clicking |
| Selected, balance < −advanceDays | Red | Overdrawn, toggle off by clicking |
| Normal weekday | No circle | Selectable |

## Key Behaviors

- All dates have tooltips on hover showing full Danish date, status reason, and current vacation balance (Saldo)
- Holidays in config pane show date tooltip on hover and highlight the corresponding calendar day with a blue ring
- Holidays are grouped by year in an accordion, filtered to only show years visible in the calendar
- Calendar view has `max-w-5xl` to prevent stretching on wide monitors
- Year range selector: "Indeværende år" (12 months) or "Indeværende + næste år" (24 months)
- State survives page refresh via localStorage
- `holidayNames` map is derived via `useMemo` from `state.holidays` for tooltip lookups
- `dayStatuses` map is precomputed via `useMemo` in the context (`computeAllStatuses`) for all visible days in a single pass, avoiding per-cell `getDayStatus` calls
- `CalendarDay` and `CalendarMonth` are wrapped in `React.memo` to skip re-renders when props (primitive strings) haven't changed
- Tooltip content (`TooltipBody`) is rendered lazily inside `TooltipContent`, so balance computation only runs on hover
- Holiday highlight ring uses a DOM-based approach (not React state) for performance: `setHighlightedDate` toggles a `data-highlighted` attribute on `[data-date]` buttons via `calendarRef`, styled with Tailwind `data-[highlighted=true]:ring-*` selectors. This avoids re-rendering all CalendarDay components on hover.
- Holiday labels in ConfigPane are clickable to toggle the holiday (same as the switch)
- "Ryd alting" button in the Data card resets state in-place via `resetState()` (no page reload). After reset, `initDefaults` re-seeds holidays from `default.json` on next render.
- Context functions (`toggleDate`, `toggleHoliday`, `initDefaults`, `addHoliday`, `resetState`) are wrapped in `useCallback` to avoid infinite re-render loops
- Current year accordion is expanded by default; other years are collapsed
- Users can add custom holidays via a Popover with a name field and native date picker
- Number inputs (Feriedage ved start, Ekstra feriedage, Forskudsferie) use `DeferredNumberInput` — local state while typing, commits to global state on blur/Enter. This avoids recomputing `dayStatuses` on every keystroke. All are clamped to 0–99.

## Locale

All UI text is in Danish. Day names: Man, Tir, Ons, Tor, Fre, Lør, Søn. Month names and date formatting use `date-fns/locale/da`.
