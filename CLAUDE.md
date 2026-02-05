Always remember to update this document (CLAUDE.md) when
- New or updated information from developer
- Changing behaviour
- Updating logic
- Updating architecture

# Ferieplan

Danish vacation day planner — client-side React app with no backend.

## Background: Danish Vacation System

- The "vacation obtain period" runs from 1 September Year 0 to 31 August Year 1.
- Vacation obtained in that period can be used from 1 September Year 0 through 31 December Year 1 (the "vacation usable period").
- Each month the employee earns 2.08 vacation days.
- At a configurable month, the employee receives a configurable number of extra days ("6. ferieuge", default 5).
- Public holidays are automatically free and do not consume vacation days.
- "Forskudsferie" (advance vacation) allows borrowing a configurable number of days before they are earned. Default 0, seeded from `default.json`.
- When a ferieår expires, up to `maxTransferDays` (default 5, configurable) surplus days can transfer to the next ferieår; excess days are lost.
- Default holiday data lives in `public/default.json` for 2026–2027. This file seeds the user's holiday list on first load (or after reset). Each holiday has a `date`, `name`, and `enabled` boolean. It also seeds `maxTransferDays`.
- The user can add custom holidays via a "Tilføj helligdag" button inside the Helligdage card content.
- Holidays (including user-added ones) are persisted in `state.holidays` in localStorage, not re-fetched from the JSON on every load.
- **Soft merge**: When loading state from localStorage or importing a saved file, missing properties are filled from `defaultState` via spread merge (`{ ...defaultState, ...stored }`). This ensures new config properties added in future versions are picked up by existing users without losing their data.

## Tech Stack

- Vite + React 19 + TypeScript (strict mode)
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin) + shadcn/ui (new-york style)
- date-fns with `da` locale for all date formatting
- localStorage for state persistence
- Vitest for unit testing
- Path alias: `@/` → `src/`

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build (runs `tsc -b && vite build`)
- `npx tsc --noEmit` — type check without build
- `npx vitest` — run unit tests
- `npx vitest run` — run tests once (no watch)

## Project Structure

```
src/
├── components/
│   ├── ui/                # shadcn components (accordion, alert-dialog, button, card, collapsible, input, label, popover, scroll-area, select, switch, tooltip)
│   ├── App.tsx            # Root: VacationProvider + TooltipProvider + 2-column layout
│   ├── HelpIcon.tsx       # Reusable "?" popover icon (click-to-open, click-outside-to-close) using lucide-react CircleHelp
│   ├── ConfigPane.tsx     # Left pane: settings, holiday toggles (accordion by year), data management (reset)
│   ├── CalendarView.tsx   # Right pane: scrollable grid of months based on yearRange, year separators
│   ├── CalendarMonth.tsx  # Single month: header with ferieår balances + 7-col day grid (Mon–Sun)
│   └── CalendarDay.tsx    # Day cell: colored circle (no tooltips)
├── context/
│   └── VacationContext.tsx # Global state with localStorage persistence
├── hooks/
│   ├── useHolidays.ts     # useDefaults() — fetches public/default.json (DefaultData)
│   ├── useLocalStorage.ts # Generic localStorage hook
│   └── useMediaQuery.ts   # Media query hook for responsive behavior
├── lib/
│   ├── utils.ts           # cn() helper (shadcn)
│   ├── dateUtils.ts       # DA_DAY_NAMES, formatMonthYear, generateMonths, getVisibleYears, toISODate
│   ├── vacationCalculations.ts  # Balance logic, day status determination
│   └── vacationCalculations.test.ts  # Vitest tests for vacation calculations
├── types/
│   └── index.ts           # Holiday, DefaultData, VacationState, YearRange, DayStatus, FerieaarBalance
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
  maxTransferDays: number;        // max days transferable between ferieår, default: 5
}

interface FerieaarBalance {
  year: number;        // ferieår start year (e.g. 2025 = Sep 2025 → Aug 2026, usable until Dec 2026)
  earned: number;      // days earned so far in this ferieår
  extra: number;       // extra days granted in this ferieår
  used: number;        // days consumed from this ferieår
  transferred: number; // days transferred from previous expired ferieår (capped by maxTransferDays)
  balance: number;     // earned + extra + transferred - used
  lost: number;        // days lost at expiry (excess beyond transferable limit)
  expired: boolean;    // true if atDate > Dec 31 of year+1
}

interface Holiday {
  date: string;    // ISO date
  name: string;    // Danish name
  enabled: boolean; // default enabled state (used when seeding)
}
```

## Vacation Calculation Logic

Balances are computed per **ferieår** (vacation year). Ferieår N runs Sep 1 Year N → Aug 31 Year N+1 (obtain period), and days are usable Sep 1 Year N → Dec 31 Year N+1.

1. Per ferieår, each elapsed month within the obtain period earns 2.08 days
2. Extra days (`extraDaysCount`) are added when the configured `extraDaysMonth` falls within the obtain period
3. Used days (selected dates excluding holidays) are allocated to the earliest non-expired ferieår with remaining balance
4. When a ferieår expires, up to `maxTransferDays` (default 5) surplus days transfer to the next ferieår; the rest are lost
5. `initialVacationDays` are added to the earliest ferieår's balance
6. A selected day is **green** if total active balance ≥ 0; **yellow** if < 0 but ≥ −advanceDays (forskudsferie); **red** if < −advanceDays (overdrawn)

A legacy `getBalance()` function still exists for backward compatibility but the per-ferieår system (`getFerieaarBalances`) is used for day status computation.

## Day Status Colors

| Status | Color | Behavior |
|--------|-------|----------|
| Weekend (Sat/Sun) | Gray | Selectable |
| Enabled holiday | Blue | Not selectable (auto-free) |
| Selected, balance ≥ 0 | Green | Toggle off by clicking |
| Selected, balance < 0 but ≥ −advanceDays | Yellow | Borrowed days (forskudsferie), toggle off by clicking |
| Selected, balance < −advanceDays | Red | Overdrawn, toggle off by clicking |
| Before start date | Gray/dimmed | Not selectable (disabled) |
| Normal weekday | No circle | Selectable |

## Key Behaviors

- All 4 ConfigPane cards are collapsible with a chevron icon in the header. Click the header to toggle collapse/expand. Default states: desktop (lg+) all expanded, mobile only first card ("Optjent ferie") expanded.
- Each config field in the settings card has a `HelpIcon` (CircleHelp from lucide-react) placed to the right of the input element. Click opens a Popover with a Danish description; click outside dismisses (touch-friendly, no hover required).
- Dates before `startDate` are disabled and not selectable (status `before-start`)
- Month headers show ferieår balances with format "YY/(YY+1): X.XX" (e.g., "25/26: 3.40"). Year label is gray, balance is green. For months Jan-Aug only the active ferieår is shown on the left. For Sep-Dec both ferieår are shown (ending year on left, new year on right).
- Year separators appear after December months spanning the full grid width with three states: (1) "Ingen feriedage overføres til næste ferieår" if balance is 0, (2) "X.XX feriedage overføres til næste ferieår" if within transfer limit, (3) "X.XX feriedage overføres til næste ferieår, Y.YY feriedage overføres ikke" if exceeding limit (Y.YY in bold red). All text is gray except the lost amount.
- Holidays in config pane show date tooltip on hover and highlight the corresponding calendar day with a blue ring
- Holidays are grouped by year in an accordion, filtered to only show years visible in the calendar
- Calendar view has `max-w-5xl` to prevent stretching on wide monitors
- Year range selector: "Indeværende år" (12 months) or "Indeværende + næste år" (24 months)
- State survives page refresh via localStorage
- `holidayNames` map is derived via `useMemo` from `state.holidays` for holiday name lookups
- `dayStatuses` map is precomputed via `useMemo` in the context (`computeAllStatuses`) for all visible days in a single pass, avoiding per-cell `getDayStatus` calls
- `CalendarDay` and `CalendarMonth` are wrapped in `React.memo` to skip re-renders when props (primitive strings) haven't changed
- Holiday highlight ring uses a DOM-based approach (not React state) for performance: `setHighlightedDate` toggles a `data-highlighted` attribute on `[data-date]` buttons via `calendarRef`, styled with Tailwind `data-[highlighted=true]:ring-*` selectors. This avoids re-rendering all CalendarDay components on hover.
- Holiday labels in ConfigPane are clickable to toggle the holiday (same as the switch)
- "Ryd alting" button in the Data card resets state in-place via `resetState()` (no page reload). After reset, `initDefaults` re-seeds holidays from `default.json` on next render.
- Context functions (`toggleDate`, `toggleHoliday`, `initDefaults`, `addHoliday`, `resetState`) are wrapped in `useCallback` to avoid infinite re-render loops
- Current year accordion is expanded by default; other years are collapsed
- Users can add custom holidays via a "Tilføj helligdag" button (opens Popover with name field and native date picker) at the top of the Helligdage card content
- Number inputs (Feriedage ved start, Ekstra feriedage, Forskudsferie) use `DeferredNumberInput` — local state while typing, commits to global state on blur/Enter. This avoids recomputing `dayStatuses` on every keystroke. All are clamped to 0–99.

## Locale

All UI text is in Danish. Day names: Man, Tir, Ons, Tor, Fre, Lør, Søn. Month names and date formatting use `date-fns/locale/da`.
