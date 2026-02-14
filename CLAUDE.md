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
- **Holiday merge**: On every load, holidays from `default.json` are merged into state. Any holidays whose date doesn't already exist in `state.holidays` are added with their default enabled state. Existing holidays and user-added holidays are preserved. This ensures new years/holidays added to `default.json` are picked up by existing users automatically. The merge is also triggered after importing a saved file.
- The user can add custom holidays via a "+" icon button in the top-right corner of the Helligdage card header.
- Holidays (including user-added ones) are persisted in `state.holidays` in localStorage.
- **Soft merge**: When loading state from localStorage or importing a saved file, missing properties are filled from `defaultState` via spread merge (`{ ...defaultState, ...stored }`). This ensures new config properties added in future versions are picked up by existing users without losing their data.

## Tech Stack

- Vite + React 19 + TypeScript (strict mode)
- React Compiler (`babel-plugin-react-compiler`) for automatic memoization
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
│   ├── App.tsx            # Root: VacationProvider + TooltipProvider + top config bar + responsive layout (sidebar on desktop, drawer on mobile)
│   ├── HelpIcon.tsx       # Reusable "?" popover icon (click-to-open, click-outside-to-close) using lucide-react CircleHelp
│   ├── ConfigPane.tsx     # Exports TopConfigBar (start date + initial days) and SidebarConfig (settings, holidays, data cards)
│   ├── CalendarView.tsx   # Right pane: scrollable grid of months based on visibleYears, year separators
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
│   ├── dateUtils.ts       # DA_DAY_NAMES, formatMonthYear, generateMonths, toISODate
│   ├── vacationCalculations.ts  # Balance logic, day status determination
│   └── vacationCalculations.test.ts  # Vitest tests for vacation calculations
├── types/
│   └── index.ts           # Holiday, DefaultData, VacationState, DayStatus, VacationYearBalance
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
  selectedDates: string[];        // ISO dates user picked as vacation
  enabledHolidays: Record<string, boolean>; // holiday date → enabled
  holidays: Holiday[];            // full holiday list (persisted, seeded from default.json)
  advanceDays: number;            // max borrowable vacation days (forskudsferie), default: 0
  maxTransferDays: number;        // max days transferable between ferieår, default: 5
}

interface VacationYearBalance {
  year: number;        // vacation year start year (e.g. 2025 = Sep 2025 → Aug 2026, usable until Dec 2026)
  earned: number;      // days earned so far in this vacation year
  extra: number;       // extra days granted in this vacation year
  used: number;        // days consumed from this vacation year
  transferred: number; // days transferred from previous expired vacation year (capped by maxTransferDays)
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

1. Per ferieår, each month within the obtain period earns 2.08 days (credited at start of month, usable from day 1; if employment starts mid-month, the full month is still credited)
2. Extra days (`extraDaysCount`) are added when the configured `extraDaysMonth` falls within the obtain period
3. Used days (selected dates excluding holidays) are allocated using **waterfall splitting**: each day is consumed from the earliest non-expired ferieår with remaining balance first; if that year has less than 1 day remaining, it takes what's available (zeroing the year) and the remainder spills to the next usable ferieår. Only when all active years are exhausted does the balance go negative (borrowing from the latest usable year).
4. When a ferieår expires, up to `maxTransferDays` (default 5) surplus days transfer to the next ferieår; the rest are lost
5. `initialVacationDays` are added to the earliest ferieår's balance
6. A selected day is **green** if total active balance ≥ 0; **yellow** if < 0 but ≥ −advanceDays (forskudsferie); **red** if < −advanceDays (overdrawn)

`computeAllStatuses` uses an event timeline + single-pass algorithm: it pre-builds sorted earn/extra/expiry events, then merge-walks them with sorted selected dates maintaining per-vacation-year running state incrementally (O(D + S·V) instead of the previous O(S²·V) approach of calling `getVacationYearBalances` per selected date). `getVacationYearBalances` is still used by `CalendarMonth` and `CalendarView` for month-header and year-separator balance display.

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

- The top config bar ("Optjente feriedage" + "Fra dato") is always visible at the top of the page above the explanatory text, in a horizontal layout with `max-w-lg` centered (`mx-auto`) to prevent inputs from stretching too wide. Order: vacation days first, start date second. Labels wrap if needed.
- Vertical spacing between settings button, config inputs, help text, and calendar uses a uniform `gap-4` (16px) on the parent flex-col, with `pt-4` for top padding. The settings button uses `mb-4` to match.
- On desktop (lg+): the sidebar config cards (Data, Indstillinger, Helligdage) are always visible in the left sidebar. Config cards are not collapsible.
- On mobile: a circular settings icon button (lucide-react `Settings`) appears above the top config bar inputs. Clicking it opens a slide-in drawer from the left containing the sidebar config cards, overlaid on a semi-dark backdrop (`bg-black/50`). Body scroll is locked when the drawer is open (`overflow: hidden` on body + `overscroll-contain` on drawer panel). Drawer auto-closes when resizing to desktop. Clicking the overlay closes the drawer.
- Each config field in the settings card has a `HelpIcon` (CircleHelp from lucide-react) placed to the right of the input element. Click opens a Popover with a Danish description; click outside dismisses (touch-friendly, no hover required).
- Dates before `startDate` are disabled and not selectable (status `before-start`)
- Month headers show ferieår balances with format "YY/(YY+1): X.XX" (e.g., "25/26: 3.40"). Year label is gray; balance color is green (positive), gray (zero), or red (negative). For months Jan-Aug only the active ferieår is shown on the left. For Sep-Dec both ferieår are shown (ending year on left, new year on right).
- Year separators appear after December months spanning the full grid width with three states: (1) "Ingen feriedage overføres til næste ferieår" if balance is 0, (2) "X.XX feriedage overføres til næste ferieår" if within transfer limit, (3) "X.XX feriedage overføres til næste ferieår, Y.YY feriedage overføres ikke" if exceeding limit (Y.YY in bold red). All text is gray except the lost amount.
- Holidays in config pane show date tooltip on hover and highlight the corresponding calendar day with a blue ring
- Holidays are grouped by year in an accordion, filtered to only show years visible in the calendar
- Calendar view has `max-w-6xl` to prevent stretching on wide monitors
- Visible years are derived automatically from `state.holidays` (unique years from holiday dates, always including current year). The calendar displays all years that have holidays configured. `visibleYears` is computed in VacationContext and exposed via context.
- State survives page refresh via localStorage
- `holidayNames` map is derived from `state.holidays` for holiday name lookups
- `dayStatuses` map is precomputed in the context (`computeAllStatuses`) for all visible days in a single pass, avoiding per-cell `getDayStatus` calls
- React Compiler automatically handles memoization (no manual `useMemo`, `useCallback`, or `React.memo` needed)
- Holiday highlight ring uses a DOM-based approach (not React state) for performance: `setHighlightedDate` toggles a `data-highlighted` attribute on `[data-date]` buttons via `calendarRef`, styled with Tailwind `data-[highlighted=true]:ring-*` selectors. This avoids re-rendering all CalendarDay components on hover.
- Holiday labels in ConfigPane are clickable to toggle the holiday (same as the switch)
- "Ryd alting" button in the Data card resets state in-place via `resetState()` (no page reload). After reset, `initDefaults` re-seeds holidays from `default.json` on next render.
- `initDefaults` performs a merge: on first load (empty holidays) it does a full seed of holidays and config values; on subsequent loads it adds any holidays from `default.json` missing in state without overwriting user config. The merge is idempotent (returns prev unchanged if nothing new).
- Context functions (`toggleDate`, `toggleHoliday`, `initDefaults`, `addHoliday`, `resetState`) have stable references (React Compiler handles this automatically)
- Current year accordion is expanded by default; other years are collapsed
- Users can add custom holidays via a "+" icon button in the top-right corner of the Helligdage card header (opens Popover with name field and native date picker)
- Number inputs (Optjente feriedage, Ekstra feriedage, Forskudsferie) use `DeferredNumberInput` — local state while typing, commits to global state on blur/Enter. This avoids recomputing `dayStatuses` on every keystroke. All are clamped to 0–99.
- Drawer animations (`drawer-slide-in`, `drawer-overlay-in`) are defined as CSS keyframes in `index.css` and registered as Tailwind theme animations.

## Locale

All UI text is in Danish. Day names: Man, Tir, Ons, Tor, Fre, Lør, Søn. Month names and date formatting use `date-fns/locale/da`.
