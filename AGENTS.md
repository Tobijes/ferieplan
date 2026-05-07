# Agent behaviour
Always remember to update this document (AGENTS.md) when
- Adding or modifying business rules
- New technical details that aren't clear from the code
- When a file is added or modified, make sure to update `Project Structure` tree

# Business Rules — Ferieplan

## 1. Ferieår (Vacation Year)

- **Period**: 1 Sep Y → 31 Aug Y+1 (obtain). **Usable**: 1 Sep Y → 31 Dec Y+1. **Expired**: after 31 Dec Y+1.
- **Mapping**: Sep–Dec Y → ferieår Y; Jan–Aug Y → ferieår Y−1.
- **Earn**: 2.08 days/month, credited 1st of month, usable immediately. Employment start rounded to month start.
- `earned = months_in_obtain_period * 2.08`
- **Balance**: `earned + transferred − used` (+ `initialVacationDays` for earliest ferieår). Snapped to 0 if `|b| < 1e-9`.
- `initialVacationDays` (default 0) added to earliest ferieår's balance.

## 2. Extra Days ("6. ferieuge")

- **Independent cycle** — not pooled, not transferred, not borrowed.
- Grant: `extraDaysCount` days on 1st of `extraDaysMonth` each year. Usable through day before next grant (exclusive).
- `expiryDate = (year+1)-MM-01`. Expired when `atDate >= expiryDate`.
- `granted = extraDaysCount`, `balance = granted − used`.
- Skipped if `extraDaysCount ≤ 0`. Skipped if start < employment start or expiry ≤ employment start.
- Recalculated from current config each time (no history).

## 3. Allocation Waterfall

For each selected non-holiday day, consumed in this order:

1. **Extra pools** — earliest first, non-expired covering the date, `consume = min(available, remaining)`. Cannot go negative.
2. **Ferieår pass 1** — earliest non-expired with `balance > 0`, `consume = min(balance, remaining)`.
3. **Ferieår pass 2 (borrow)** — latest usable ferieår, `used += remaining`, break. Only ferieår can be borrowed.

## 4. Transfer

On ferieår expiry: `surplus = max(0, balance)`, `transferable = min(surplus, maxTransferDays)`, `lost = surplus − transferable`. Transfer only to immediate next ferieår. Extra days excluded. `initialVacationDays` are transferable as part of the balance.

## 5. Forskudsferie (Borrowing)

- `advanceDays` (default 0) = max borrowable. At 0, any negative is overdrawn.
- Total active balance: sum of all non-expired ferieår balances + non-expired extra pool balances.
- Selected day: **green** if total ≥ 0; **yellow** if −advanceDays ≤ total < 0; **red** if total < −advanceDays.

## 6. Day Statuses

| Status | Condition | Selectable |
|---|---|---|
| `before-start` | date < startDate | No |
| `holiday` | enabled holiday | No |
| `weekend` | Sat/Sun, not selected, not holiday | Yes |
| `normal` | weekday, not selected, not holiday, ≥ startDate | Yes |
| `selected-ok` | selected, total balance ≥ 0 | Yes (toggle off) |
| `selected-warning` | selected, −advanceDays ≤ total < 0 | Yes (toggle off) |
| `selected-overdrawn` | selected, total < −advanceDays | Yes (toggle off) |

Computed via single-pass event timeline: sorted `earn`(+2.08), `extra-grant`, `expiry`(transfer then expire), `extra-expiry` events merge-walked with sorted selected dates.

## 9. Holiday Rules

- **Enabled** holiday → auto-free, not selectable. **Disabled** holiday → normal day, selectable.
- `enabledHolidays` controls active state; `holidays[]` is master list of all known holidays.
- **Merge on load**: new dates from default.json added to `holidays[]` with default `enabled`; existing (incl. user-added) preserved. Idempotent. Also triggered after file import.
- **User-added**: custom holidays persisted in `holidays[]`.

## 10. State Initialization

- **Soft merge**: `{ ...defaultState, ...stored }` — missing properties filled from defaults.
- **Holiday merge**: new default holidays added, existing preserved.
- User config always preserved from stored state.
- **Reset**: clears state, re-seeds from default.json on next render.

## 11. User Actions

- **toggleDate**: no-op if holiday or before start. Toggle selection — deselect if selected, select if not.
- **toggleHoliday**: enable → disable (selected dates on that day stay selected, now consuming balance). Disable → enable (deselects dates on that day).
- **addHoliday**: name + date → added to `holidays[]`, enabled in `enabledHolidays`. Deselects that date if selected.
- **resetState**: clears all state to defaults.


# Technical Documentaiton

## Tech Stack

- Vite + React 19 + TypeScript (strict mode)
- React Compiler (`babel-plugin-react-compiler`) for automatic memoization
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin) + shadcn/ui (new-york style)
- date-fns with `da` locale for all date formatting
- Firebase Authentication (Email/Password) + Cloud Storage for optional cloud sync
- localStorage for state persistence (primary); Cloud Storage as sync layer when logged in
- Vitest for unit testing
- Path alias: `@/` → `src/`
- Environment variables: Firebase config via `VITE_FIREBASE_*` in `.env` (see `.env.example`)


## Commands

- `npm run dev` — start dev server
- `npm run build` — production build (runs `tsc -b && vite build`)
- `npx tsc --noEmit` — type check without build
- `npx vitest` — run unit tests
- `npx vitest run` — run tests once (no watch)

## Locale

All UI text is in Danish. Day names: Man, Tir, Ons, Tor, Fre, Lør, Søn. Month names and date formatting use `date-fns/locale/da`.

## Firebase Integration (Optional Cloud Sync)

- **Authentication**: Email/Password (with in-app registration).
- **Storage**: Cloud Storage for Firebase. State is stored as a JSON file at `users/{uid}/ferieplan.json`.
- **Login is optional**: The app works identically without login (localStorage only). No Firebase calls are made when not logged in.
- **Async initialization**: `initFirebase()` in `src/lib/firebase.ts` fetches `/config.json` (runtime config from Docker entrypoint) and falls back to `import.meta.env.VITE_*` (build-time, for local dev). Firebase only initializes if `apiKey` and `projectId` are set. Without them, `auth` and `storage` remain `null`.
- **Auth flow**: `AuthContext` listens to `onAuthStateChanged`. Provides `signInWithEmail(email, password)` and `registerWithEmail(email, password)` (uses `createUserWithEmailAndPassword`).
- **Generation-based sync**: Cloud Storage's `generation` metadata field is used for optimistic concurrency. The generation string is stored locally in `ferieplan-cloud-generation` localStorage key (separate from VacationState). On page reload, a metadata-only check (`getCloudGeneration`) compares local and cloud generations — if they match, no download is needed.
- **Debounced upload (2.5s)**: Local edits set sync status to `'pending'`. After 2.5 seconds of no further edits, the debounce fires: checks cloud generation matches expected, then uploads. If cloud generation is newer (another device edited), shows `SyncConflictDialog` with "overwrite" or "fetch newest" choices.
- **Initial sync on login**:
  - If local generation exists (page reload): metadata-only check, download only if cloud is newer
  - Fresh login with cloud data (existing account) → silently download (cloud is source of truth)
  - Fresh login with no cloud data (new account) → upload local data to seed the cloud
- **Logout**: Clears generation from localStorage but keeps local data.
- **Data card UI**:
  - Sync status icon in top-right of Data card header (via `CardAction`): gray `CircleMinus` (disconnected), gray `Loader2` spinner (syncing), green `CircleCheck` (synced), yellow `CircleDot` (pending local edits), red `CircleMinus` (error). Clicking shows a toast with status description.
  - Logged out: "Log ind" button (opens LoginDialog) + "Ryd" button
  - Logged in: user email in card header title, "Log ud" button + "Ryd" button
- **Security rules**: Each user can only read/write their own `users/{uid}/ferieplan.json` file.
- **Environment variables**: For local dev, use `VITE_FIREBASE_*` in `.env`. For Docker, pass `FIREBASE_*` (without `VITE_` prefix) as runtime env vars — the entrypoint script (`custom-entrypoint.sh`) generates `/config.json` from them. See `.env.example`.
- **Environment label**: A small text label at the bottom of the sidebar shows the environment name (`VITE_ENVIRONMENT_NAME` for local dev / `ENVIRONMENT_NAME` for Docker). Values: "Local" (`.env`), "Development" (`compose.dev.yml`), "Production" (`compose.prod.yml`), "Preview" (set externally). Hidden if not set. The value is read during `initFirebase()` and exported as `environmentName` from `firebase.ts`.


# Project structure

```
src/
├── components/
│   ├── ui/                # shadcn components (accordion, alert-dialog, button, card, dialog, input, label, popover, select, switch, tooltip)
│   ├── App.tsx            # Root: AuthProvider + VacationProvider + TooltipProvider + responsive layout + SyncConflictDialog
│   ├── HelpIcon.tsx       # Reusable "?" popover icon (click-to-open, click-outside-to-close) using lucide-react CircleHelp
│   ├── ConfigPane.tsx     # Exports TopConfigBar (start date + initial days) and SidebarConfig (settings, holidays, data cards)
│   ├── LoginDialog.tsx    # Login dialog (email/password form with registration toggle)
│   ├── SyncConflictDialog.tsx # Cloud sync conflict dialog (upload local / download cloud)
│   ├── CalendarView.tsx   # Right pane: scrollable grid of months based on visibleYears, year separators
│   ├── CalendarMonth.tsx  # Single month: header with ferieår balances + 7-col day grid (Mon–Sun)
│   └── CalendarDay.tsx    # Day cell: colored circle (no tooltips)
├── context/
│   ├── AuthContext.tsx     # Firebase Auth context (Email/Password), provides user/loading/signInWithEmail/registerWithEmail/logout
│   └── VacationContext.tsx # Global state with localStorage persistence + generation-based cloud sync when logged in
├── hooks/
│   ├── useHolidays.ts     # useDefaults() — fetches public/default.json (DefaultData)
│   ├── useLocalStorage.ts # Generic localStorage hook
│   └── useMediaQuery.ts   # Media query hook for responsive behavior
├── lib/
│   ├── utils.ts           # cn() helper (shadcn)
│   ├── firebase.ts        # Firebase app init, exports auth + storage (null if unconfigured)
│   ├── cloudStorage.ts    # saveStateToCloud / loadStateFromCloud / getCloudGeneration (Cloud Storage read/write with generation tracking)
│   ├── dateUtils.ts       # DA_DAY_NAMES, formatMonthYear, generateMonths, toISODate
│   ├── vacationCalculations.ts  # Balance logic, day status determination
│   └── vacationCalculations.test.ts  # Vitest tests for vacation calculations
├── types/
│   └── index.ts           # Holiday, DefaultData, VacationState, DayStatus, VacationYearBalance, ExtraDayPeriod, VacationYearBalancesResult, SyncStatus
├── main.tsx
└── index.css              # Tailwind imports + CSS variables (light theme only)
public/
└── default.json           # Default holidays 2026–2027 + extraHoliday config
.env.example               # Firebase config env var template (dev + Docker)
Dockerfile                 # Multi-stage: Node build → NGINX Alpine runtime
custom-entrypoint.sh       # Generates /config.json from env vars, delegates to nginx entrypoint
nginx.conf                 # NGINX config (SPA routing, health endpoint)
```