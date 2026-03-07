# Date & Timezone Handling — Architecture Audit

**Date:** 2026-03-07
**Scope:** Full codebase review of date/time creation, storage, parsing, formatting, and conversion.

---

## 1. Current Architecture Summary

### Storage Layer (Supabase / PostgreSQL)

All timestamp columns use `timestamp with time zone` (`timestamptz`), which stores values in UTC. Calendar-only fields (e.g. `date_of_birth`, `expiry_date` on memberships, `override_date` on shift overrides) use the `date` type. Roster rule times (`start_time`, `end_time` on `roster_rules` / `shift_overrides`) use `time without time zone` — representing wall-clock time in the tenant's timezone by convention.

The tenant's IANA timezone string lives on `tenants.timezone` (default `'Pacific/Auckland'`). Business-hours settings are in `tenant_settings.settings` (a JSONB blob with keys like `business_open_time`, `business_close_time`).

**Verdict:** Storage design is sound. UTC for timestamps, `date` for date-only, `time` for wall-clock — all correct.

### Core Timezone Utilities (`lib/utils/timezone.ts`)

A well-written, zero-dependency module providing:

| Function | Purpose |
|---|---|
| `getZonedYyyyMmDdAndHHmm(date, timeZone)` | UTC Date → `{yyyyMmDd, hhmm}` in tenant TZ |
| `zonedTodayYyyyMmDd(timeZone)` | Today's date key in tenant TZ |
| `zonedDateTimeToUtc({dateYyyyMmDd, timeHHmm, timeZone})` | Local wall-clock → UTC Date (iterative convergence, DST-safe) |
| `zonedDayRangeUtcIso({dateYyyyMmDd, timeZone})` | Full day boundary in UTC for DB queries |
| `addDaysYyyyMmDd`, `dayOfWeekFromYyyyMmDd`, `isValidDateKey`, `resolveDateKey` | Date-key arithmetic and validation |

Uses `Intl.DateTimeFormat` with `formatToParts` and a `Map`-based formatter cache. The iterative convergence in `zonedDateTimeToUtc` is a robust approach for DST transitions.

**Verdict:** This is well-engineered and DST-safe. It should be the authoritative source for all timezone operations.

### Tenant Timezone Propagation

The timezone flows from the database to the UI through page-level data fetching:

```
DB (tenants.timezone)
  → Server Component / API route fetches it
    → Passes as prop/data to client components
      → Used in Intl.DateTimeFormat for display
```

There is **no** React Context or hook for timezone. Each feature independently fetches and threads the timezone through props.

---

## 2. Findings — Weaknesses, Risks, and Inconsistencies

### Finding 1: CRITICAL — Hardcoded Timezone in Bookings Page

**File:** `components/bookings/bookings-page-client.tsx` line 70
```typescript
const timeZone = "Pacific/Auckland"
```

The bookings list page uses a hardcoded timezone instead of the tenant's configured timezone. For any tenant not in `Pacific/Auckland`, the "Today" tab filter and date grouping will be wrong.

**Risk:** Bookings shown under wrong date for non-NZ tenants.
**Severity:** High

---

### Finding 2: HIGH — Browser-Local Timezone Used for Display (Missing `timeZone` option)

Multiple components format dates/times using `toLocaleDateString` / `toLocaleTimeString` / `toLocaleString` **without** passing a `timeZone` option. This means dates render in the **browser's local timezone**, not the tenant's timezone.

| File | Function/Usage | Impact |
|---|---|---|
| `bookings-table.tsx` (lines 136, 142, 161, 166, 281, 288) | Date/time columns | Booking dates/times wrong if browser TZ ≠ tenant TZ |
| `cancel-booking-modal.tsx` (lines 52, 57) | Cancellation confirmation label | Shows wrong date/time |
| `booking-header.tsx` (line 96) | Booking detail header | Shows wrong date |
| `booking-detail-client.tsx` (lines 99, 396) | Booking detail view + audit log | Shows wrong date/time |
| `booking-checkin-client.tsx` (line 2441) | Correction timestamp | Shows wrong date/time |
| `debrief-view-client.tsx` (lines 51, 58) | Debrief date labels | Shows wrong date |
| `debrief-edit-client.tsx` (line 27) | Debrief edit form | Shows wrong date |
| `member-flight-history-tab.tsx` (line 49) | Flight history dates | Shows wrong date |
| `member-upcoming-bookings-table.tsx` (lines 34, 44) | Upcoming bookings | Shows wrong date/time |
| `member-pilot-details.tsx` (line 120) | License/medical dates | Shows wrong date |
| `member-detail-client.tsx` (line 63) | Member detail dates | Shows wrong date |
| `member-finances.tsx` (line 25) | Transaction dates | Shows wrong date |
| `member-memberships.tsx` (line 42) | Membership dates | Shows wrong date |
| `create-membership-modal.tsx` (line 47) | New membership dates | Shows wrong date |
| `renew-membership-modal.tsx` (line 45) | Renewal dates | Shows wrong date |
| `instructors-table.tsx` (line 51) | Instructor table dates | Shows wrong date |
| `instructor-detail-client.tsx` (line 159) | Instructor detail dates | Shows wrong date |
| `instructor-detail-utils.ts` (lines 22, 35) | Shared instructor formatters | Shows wrong date/time |
| `instructor-charge-rates-table.tsx` (line 46) | **No locale at all** | Format varies by browser |
| `equipment-table.tsx` (line 125) | Equipment dates | Shows wrong date |
| `equipment-updates-table.tsx` (line 24) | Update history dates | Shows wrong date |
| `equipment-issuance-table.tsx` (line 23) | Issuance dates | Shows wrong date |
| `return-equipment-modal.tsx` (line 148) | Return modal dates | Shows wrong date |
| `invoices-table.tsx` (lines 79, 86) | Invoice dates | Shows wrong date |
| `invoice-document-view.tsx` (line 36) | Invoice PDF dates | Shows wrong date |
| `invoice-report-pdf.tsx` (line 217) | Invoice report dates | Shows wrong date |
| `chart-area-interactive.tsx` (lines 252, 263) | Chart axis labels | Shows wrong date |
| `aircraft/` (multiple files) | Maintenance, observations, TTIS audit | Shows wrong date |
| `scheduler/new-booking-modal.tsx` (lines 201, 209) | `formatDdMmmYyyy`, `formatEeeDdMmm` | Shows wrong date |

**Risk:** Any user whose browser timezone differs from the tenant's configured timezone will see incorrect dates. This is the single largest systemic issue.
**Severity:** High (currently masked because most users are likely in `Pacific/Auckland`)

---

### Finding 3: HIGH — Membership Status Uses Browser-Local "Today"

**File:** `lib/utils/membership-utils.ts` (lines 28, 49, 58)

```typescript
const today = startOfDay(new Date())
```

`calculateMembershipStatus`, `getDaysUntilExpiry`, and `getGracePeriodRemaining` all compute "today" using the server/browser's local timezone. Since `new Date()` on the server (Vercel/Node) will typically be UTC, and `startOfDay` uses `getFullYear()`/`getMonth()`/`getDate()` (local-time methods), the "today" boundary might differ from the tenant's actual date by up to ±1 day.

**Risk:** Membership status could be calculated against the wrong date boundary. A membership expiring "today" in NZ (UTC+12/13) might show as "active" when the server evaluates it at UTC midnight.
**Severity:** High (edge case but real, especially around midnight)

---

### Finding 4: MEDIUM — Duplicated Helper Functions

The same utility logic is reimplemented across many files:

| Function | Duplicate Locations |
|---|---|
| `startOfDay(date)` | `lib/utils/membership-utils.ts`, `components/ui/calendar.tsx`, `components/members/member-flight-history-tab.tsx`, `components/aircraft/aircraft-flight-history-tab.tsx`, `components/rosters/roster-scheduler.tsx`, `lib/bookings/fetch-booking-checkout-warnings.ts` |
| `endOfDay(date)` | `components/members/member-flight-history-tab.tsx`, `components/aircraft/aircraft-flight-history-tab.tsx` |
| `formatDate(value)` | 20+ local definitions across components |
| `formatTime(value, timeZone)` | Duplicated identically in `flying-now-card.tsx`, `upcoming-today-card.tsx`, `booking-requests-card.tsx` |
| `parseTimeToMinutes(value)` | `lib/roster/availability.ts`, `components/scheduler/resource-timeline-scheduler.tsx` |
| `zonedYyyyMmDd(date, timeZone)` | `components/bookings/bookings-page-client.tsx` (duplicates core `getZonedYyyyMmDdAndHHmm`) |

**Risk:** Maintenance burden, inconsistent behavior if one copy is fixed but others aren't. Each `formatDate` uses a different locale and format.
**Severity:** Medium

---

### Finding 5: MEDIUM — Inconsistent Locale Usage

The codebase uses **five different locales** for date formatting:

| Locale | Usage | Date Format |
|---|---|---|
| `en-NZ` | Debrief, members, aircraft, bookings (cancel/checkout), scheduler | `DD Mon YYYY` |
| `en-US` | Bookings table, instructors, invoices, dashboard, charts, member details | `Mon DD, YYYY` |
| `en-GB` | Equipment components | `DD Mon YYYY` |
| `en-CA` | Timezone utility (for `YYYY-MM-DD`), bookings-page-client | `YYYY-MM-DD` |
| `sv-SE` | API routes (for `YYYY-MM-DD`) | `YYYY-MM-DD` |
| (none) | `instructor-charge-rates-table.tsx` | Browser default |

**Risk:** Users see different date formats depending on which page they're viewing. This is confusing and unprofessional.
**Severity:** Medium

---

### Finding 6: MEDIUM — `new Date(string)` Parsing Without Explicit UTC

**Files:** `app/api/bookings/trial/route.ts` (line 74), `lib/bookings/create-booking.ts` (line 51)

```typescript
const startDate = new Date(payload.start_time)
```

The `Date` constructor parsing behavior depends on the string format. ISO 8601 strings with `Z` or an offset are unambiguous, but bare date strings (e.g. `2026-03-07`) are parsed as UTC in some engines and local time in others (per spec, date-only strings are UTC, but date-time strings without a zone are local).

**Risk:** Fragile parsing if upstream code ever sends non-ISO strings.
**Severity:** Medium (currently safe if all callers send ISO strings with `Z`)

---

### Finding 7: MEDIUM — `parseSupabaseUtcTimestamp` Patching

**File:** `components/scheduler/resource-timeline-scheduler.tsx` (lines 417-420)

The scheduler has a defensive function that appends `Z` to timestamps that lack a timezone suffix. This suggests uncertainty about whether Supabase returns timestamps with or without `Z`.

**Risk:** Indicates a systemic assumption that should be validated and documented.
**Severity:** Low-Medium

---

### Finding 8: MEDIUM — No Timezone Context Provider

The tenant timezone is fetched and threaded through props on a per-page basis. There is no `TimezoneContext` or `useTimezone()` hook. This means:

- Every page/feature must independently fetch and propagate the timezone
- Components deep in the tree need timezone threaded through multiple prop layers
- Some components (e.g. `bookings-page-client.tsx`) have fallen through the cracks and use hardcoded values

**Risk:** Prop-drilling leads to missed components and hardcoded fallbacks.
**Severity:** Medium

---

### Finding 9: LOW — Timeline Utilities Use Local Browser Time

**File:** `lib/scheduler/timeline.ts` (lines 14-21)

```typescript
export function minutesFromMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes()
}
export function withTime(baseDate: Date, hour: number, minute: number) {
  const d = new Date(baseDate)
  d.setHours(hour, minute, 0, 0)
  return d
}
```

These use `getHours()`/`setHours()` (local-time methods). In the scheduler, these are called with dates that have already been positioned relative to the timezone, so it works — but the functions are timezone-naive by design.

**Risk:** Safe in current usage because the scheduler pre-converts to zoned time. Would break if reused in a different context.
**Severity:** Low

---

### Finding 10: LOW — Calendar/Date-Picker Uses Browser Local Time

**Files:** `components/scheduler/resource-timeline-scheduler.tsx` (lines 257-268), `components/scheduler/new-booking-modal.tsx` (lines 186-199)

```typescript
function dateToKeyFromCalendar(date: Date) {
  // Uses date.getFullYear(), date.getMonth(), date.getDate() — browser local
}
```

Calendar date pickers extract date components using local-time methods. If the browser timezone differs significantly from the tenant timezone, a user picking "March 7" at 11pm could inadvertently create a booking for "March 8" in UTC.

**Risk:** Off-by-one day at date boundaries when browser TZ ≠ tenant TZ.
**Severity:** Low (partially mitigated by the subsequent `zonedDateTimeToUtc` conversion)

---

### Finding 11: LOW — Limited Timezone Options

**File:** `components/settings/general-tab.tsx` (lines 588-596)

Only 6 timezone options are available:
- Pacific/Auckland
- Australia/Sydney
- America/Los_Angeles
- America/New_York
- Europe/London
- UTC

**Risk:** Tenants in other regions cannot select their correct timezone.
**Severity:** Low (can be expanded later; existing tenants are covered)

---

### Finding 12: LOW — `sv-SE` Locale Trick for YYYY-MM-DD

**Files:** `app/api/bookings/trial/route.ts` (line 182), `lib/bookings/create-booking.ts` (line 195)

```typescript
const dateStr = startDate.toLocaleDateString("sv-SE", { timeZone: tz })
```

Using the Swedish locale as a hack to get `YYYY-MM-DD` output. This is fragile — locale behavior could change. The codebase already has `getZonedYyyyMmDdAndHHmm()` which does this correctly.

**Risk:** Locale-dependent behavior.
**Severity:** Low

---

## 3. Recommended Architecture

### Principles

1. **UTC everywhere in storage and transport** — already in place, maintain it.
2. **Single source of truth for timezone** — tenant timezone available via context, not prop-drilling.
3. **Centralized formatting** — one set of formatting functions used by all components.
4. **Explicit timezone boundaries** — every format/display call must specify the timezone; never rely on browser default.
5. **No `new Date()` for "today" comparisons** — always use `zonedTodayYyyyMmDd(timeZone)` or a timezone-aware "now".

### Proposed Layer Diagram

```
┌──────────────────────────────────────────────┐
│                 Database (UTC)                │
│  timestamptz columns store UTC               │
│  date columns store calendar dates           │
│  time columns store wall-clock times         │
└─────────────────────┬────────────────────────┘
                      │
┌─────────────────────▼────────────────────────┐
│           Server Layer (UTC)                  │
│  • new Date() → always UTC                   │
│  • Fetch tenant timezone from DB             │
│  • Use zonedDayRangeUtcIso() for queries     │
│  • Use getZonedYyyyMmDdAndHHmm() for dates  │
│  • Pass timeZone to client via page data     │
└─────────────────────┬────────────────────────┘
                      │
┌─────────────────────▼────────────────────────┐
│        TimezoneProvider (React Context)       │
│  • Set once per layout from server data      │
│  • Provides useTimezone() hook               │
│  • All child components access tenant TZ     │
└─────────────────────┬────────────────────────┘
                      │
┌─────────────────────▼────────────────────────┐
│     Centralized Format Utilities              │
│  • formatDate(iso, tz, style)                │
│  • formatTime(iso, tz, style)                │
│  • formatDateTime(iso, tz, style)            │
│  • formatRelativeTime(iso, tz)               │
│  • All accept ISO string + IANA timezone     │
│  • All use Intl.DateTimeFormat with timeZone │
└──────────────────────────────────────────────┘
```

---

## 4. Refactoring Plan

### Phase 1: Foundation (Non-Breaking)

**Step 1.1 — Create `TimezoneProvider` context**

Create `contexts/timezone-context.tsx`:
```typescript
"use client"

import * as React from "react"

type TimezoneContextValue = {
  timeZone: string
}

const TimezoneContext = React.createContext<TimezoneContextValue>({
  timeZone: "UTC",
})

export function TimezoneProvider({
  timeZone,
  children,
}: {
  timeZone: string
  children: React.ReactNode
}) {
  const value = React.useMemo(() => ({ timeZone }), [timeZone])
  return (
    <TimezoneContext.Provider value={value}>
      {children}
    </TimezoneContext.Provider>
  )
}

export function useTimezone() {
  return React.useContext(TimezoneContext)
}
```

Wire it into the authenticated layout (`app/dashboard/layout.tsx` or equivalent) by fetching `tenants.timezone` once and wrapping children with `<TimezoneProvider timeZone={tenantTimezone}>`.

**Step 1.2 — Create centralized format utilities**

Add to `lib/utils/date-format.ts`:
```typescript
const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getCachedFormatter(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const existing = formatterCache.get(key)
  if (existing) return existing
  const formatter = new Intl.DateTimeFormat("en-NZ", options)
  formatterCache.set(key, formatter)
  return formatter
}

export function formatDate(
  value: string | Date | null | undefined,
  timeZone: string,
  style: "short" | "medium" | "long" = "medium"
): string {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const options: Intl.DateTimeFormatOptions = { timeZone }
  switch (style) {
    case "short":
      options.day = "2-digit"
      options.month = "short"
      break
    case "medium":
      options.day = "2-digit"
      options.month = "short"
      options.year = "numeric"
      break
    case "long":
      options.weekday = "long"
      options.day = "numeric"
      options.month = "long"
      options.year = "numeric"
      break
  }

  const key = `date:${style}:${timeZone}`
  return getCachedFormatter(key, options).format(date)
}

export function formatTime(
  value: string | Date | null | undefined,
  timeZone: string,
  style: "24h" | "12h" = "24h"
): string {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    ...(style === "24h" ? { hourCycle: "h23" } : { hour12: true }),
  }

  const key = `time:${style}:${timeZone}`
  return getCachedFormatter(key, options).format(date)
}

export function formatDateTime(
  value: string | Date | null | undefined,
  timeZone: string,
  style: "short" | "medium" = "medium"
): string {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const options: Intl.DateTimeFormatOptions = { timeZone }
  switch (style) {
    case "short":
      options.day = "2-digit"
      options.month = "short"
      options.hour = "2-digit"
      options.minute = "2-digit"
      options.hourCycle = "h23"
      break
    case "medium":
      options.day = "2-digit"
      options.month = "short"
      options.year = "numeric"
      options.hour = "2-digit"
      options.minute = "2-digit"
      options.hourCycle = "h23"
      break
  }

  const key = `datetime:${style}:${timeZone}`
  return getCachedFormatter(key, options).format(date)
}

export function formatDateRange(
  start: string | Date,
  end: string | Date,
  timeZone: string
): string {
  return `${formatTime(start, timeZone)} – ${formatTime(end, timeZone)}`
}
```

**Step 1.3 — Create centralized date helpers**

Add to `lib/utils/date-helpers.ts`:
```typescript
export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function endOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))
}

export function parseIsoOrNull(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function toIsoDateString(date: Date, timeZone: string): string {
  // Use the existing getZonedYyyyMmDdAndHHmm for timezone-aware date key
  const { yyyyMmDd } = getZonedYyyyMmDdAndHHmm(date, timeZone)
  return yyyyMmDd
}
```

### Phase 2: Migrate Components (Incremental, Non-Breaking)

**Step 2.1 — Fix the hardcoded timezone in `bookings-page-client.tsx`**

This is the most impactful single-line fix:
```typescript
// Before
const timeZone = "Pacific/Auckland"

// After — accept timeZone as a prop from the server component
```

Update `app/bookings/page.tsx` to fetch the tenant timezone and pass it down.

**Step 2.2 — Migrate `bookings-table.tsx` and `cancel-booking-modal.tsx`**

Replace browser-local formatting with the centralized formatters + tenant timezone (from props or `useTimezone()`).

**Step 2.3 — Migrate remaining components**

Work through the list in Finding 2, replacing each `toLocaleDateString`/`toLocaleTimeString`/`toLocaleString` call (that lacks a `timeZone` option) with the centralized formatter.

Priority order:
1. Booking-related (bookings-table, booking-header, booking-detail, cancel-modal, checkin)
2. Debrief (debrief-view, debrief-edit)
3. Member-related (flight history, upcoming, memberships, finances, details, pilot-details)
4. Instructor-related (instructors-table, instructor-detail)
5. Invoice-related (invoices-table, invoice-document-view, invoice-report)
6. Equipment-related (equipment-table, updates, issuance, return-modal)
7. Aircraft-related (maintenance, observations, TTIS audit)
8. Charts and misc

**Step 2.4 — Fix membership status timezone**

Update `lib/utils/membership-utils.ts` to accept a `timeZone` parameter and use `zonedTodayYyyyMmDd(timeZone)` instead of `startOfDay(new Date())`.

**Step 2.5 — Replace `sv-SE` locale hack**

In `app/api/bookings/trial/route.ts` and `lib/bookings/create-booking.ts`, replace:
```typescript
startDate.toLocaleDateString("sv-SE", { timeZone: tz })
```
with:
```typescript
getZonedYyyyMmDdAndHHmm(startDate, tz).yyyyMmDd
```

**Step 2.6 — Consolidate duplicated helpers**

Remove local `startOfDay`, `endOfDay`, `formatDate`, `formatTime`, `parseTimeToMinutes` definitions from individual components and import from the centralized modules.

### Phase 3: Polish and Harden

**Step 3.1 — Standardize on one locale**

Choose `en-NZ` as the default display locale (or make it tenant-configurable). Remove all other locale variants.

**Step 3.2 — Add `useFormattedDate` / `useFormattedTime` hooks (optional)**

```typescript
export function useFormattedDate(
  value: string | Date | null | undefined,
  style: "short" | "medium" | "long" = "medium"
): string {
  const { timeZone } = useTimezone()
  return React.useMemo(() => formatDate(value, timeZone, style), [value, timeZone, style])
}
```

**Step 3.3 — Expand timezone options**

Replace the hardcoded 6-timezone select with a full `Intl.supportedValuesOf("timeZone")` list grouped by region, or use a searchable combobox.

**Step 3.4 — Add lint rules**

Consider adding an ESLint rule (or code review checklist) to flag:
- `toLocaleDateString()` / `toLocaleTimeString()` without a `timeZone` option
- `new Date().getHours()` / `getMonth()` etc. in non-utility code
- Hardcoded timezone strings

---

## 5. Proposed Utilities — Summary

### File: `lib/utils/timezone.ts` (existing — keep as-is)

Already provides: `getZonedYyyyMmDdAndHHmm`, `zonedTodayYyyyMmDd`, `zonedDateTimeToUtc`, `zonedDayRangeUtcIso`, `addDaysYyyyMmDd`, `dayOfWeekFromYyyyMmDd`, `isValidDateKey`, `resolveDateKey`.

### File: `lib/utils/date-format.ts` (new)

| Export | Signature | Purpose |
|---|---|---|
| `formatDate` | `(value, timeZone, style?) → string` | Format a date for display |
| `formatTime` | `(value, timeZone, style?) → string` | Format a time for display |
| `formatDateTime` | `(value, timeZone, style?) → string` | Format a date+time for display |
| `formatDateRange` | `(start, end, timeZone) → string` | Format a time range |

### File: `lib/utils/date-helpers.ts` (new)

| Export | Signature | Purpose |
|---|---|---|
| `parseIsoOrNull` | `(value) → Date \| null` | Safely parse ISO strings |
| `startOfDayUtc` | `(date) → Date` | Midnight UTC for a given date |
| `endOfDayUtc` | `(date) → Date` | 23:59:59.999 UTC |
| `toIsoDateString` | `(date, timeZone) → string` | Timezone-aware YYYY-MM-DD |

### File: `contexts/timezone-context.tsx` (new)

| Export | Signature | Purpose |
|---|---|---|
| `TimezoneProvider` | `({ timeZone, children })` | Context provider |
| `useTimezone` | `() → { timeZone }` | Hook to access tenant TZ |

### File: `hooks/use-formatted-date.ts` (new, optional)

| Export | Signature | Purpose |
|---|---|---|
| `useFormattedDate` | `(value, style?) → string` | Memoized date formatting with tenant TZ |
| `useFormattedTime` | `(value, style?) → string` | Memoized time formatting with tenant TZ |
| `useFormattedDateTime` | `(value, style?) → string` | Memoized date+time formatting |

---

## 6. Migration / Safety Notes

### How to Refactor Safely

1. **Phase 1 is additive only.** Creating the new utilities and context does not change any existing behavior. All existing code continues to work.

2. **Phase 2 should be done file-by-file.** Each component migration is independent. Merge each migration separately so regressions can be bisected.

3. **Test each migration visually.** Since there's no automated test suite, verify each migrated component by:
   - Checking the rendered output matches the previous format
   - Testing with the dev server in a browser with a non-NZ timezone (e.g., set `TZ=America/New_York` in the terminal before starting the dev server, or use Chrome DevTools to override the browser timezone)

4. **The `TimezoneProvider` must wrap all authenticated routes.** Place it in the shared layout that wraps dashboard, bookings, scheduler, etc. This ensures `useTimezone()` always returns the correct value.

5. **Don't change UTC storage.** All database writes should continue to use `.toISOString()` for `timestamptz` columns.

6. **Preserve the existing `en-CA` formatter in `timezone.ts`.** It's used internally for reliable `YYYY-MM-DD` extraction and should not be changed.

7. **The `sv-SE` trick can be migrated to use `getZonedYyyyMmDdAndHHmm` with zero risk.** The output format is identical.

8. **Membership utils require a function signature change.** `calculateMembershipStatus` et al. need a `timeZone` parameter added. Callers must be updated to pass it. This is a coordinated change across the membership display components.

### Rollback Strategy

Since each phase and step is independently deployable, rollback is simply reverting the specific commit. No database migrations are required for any of these changes.

---

## 7. Risk Matrix Summary

| # | Finding | Severity | Effort to Fix | Priority |
|---|---|---|---|---|
| 1 | Hardcoded `Pacific/Auckland` in bookings page | High | Low (1 file) | P0 |
| 2 | Browser-local timezone in 30+ components | High | Medium (systematic) | P1 |
| 3 | Membership status uses browser-local "today" | High | Low (1 file + callers) | P1 |
| 4 | Duplicated helper functions | Medium | Medium | P2 |
| 5 | Inconsistent locale usage | Medium | Medium | P2 |
| 6 | Fragile `new Date(string)` parsing | Medium | Low | P3 |
| 7 | `parseSupabaseUtcTimestamp` patching | Low-Med | Low | P3 |
| 8 | No timezone context provider | Medium | Low (foundation) | P1 |
| 9 | Timeline utils use local time | Low | N/A (safe in context) | P4 |
| 10 | Calendar uses browser local time | Low | Low | P3 |
| 11 | Limited timezone options | Low | Low | P4 |
| 12 | `sv-SE` locale hack | Low | Low | P3 |

---

## 8. Conclusion

The current date/time architecture has a **solid foundation** — UTC storage is correct, the core `lib/utils/timezone.ts` module is well-engineered and DST-safe, and the server-side timezone-aware queries work properly. The system "works" today because most users are in the default `Pacific/Auckland` timezone and use browsers set to the same zone.

The primary risk is the **lack of centralization** in the display layer. With 30+ components independently formatting dates using browser-local time, and 20+ separate `formatDate` function definitions, the system is fragile and will break for any tenant in a different timezone. The recommended refactoring plan addresses this with:

1. A `TimezoneProvider` context (eliminates prop-drilling and hardcoded fallbacks)
2. Centralized format utilities (eliminates duplication, enforces consistency)
3. Systematic migration of all display components (eliminates browser-local rendering)

The refactoring is entirely backward-compatible and can be done incrementally without changing any behavior for existing users in `Pacific/Auckland`.
