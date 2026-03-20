# Flight Desk — Vercel React Best Practices Audit

**Started:** 2026-03-20  
**Next.js:** 16.1.6 | **React:** 19.2.3 | **Deploy target:** Vercel (syd1)

---

## Audit Checklist (per group)

Each feature group is reviewed against these categories from the Vercel guide:

| # | Category | Priority |
|---|----------|----------|
| 1 | Eliminating Waterfalls | CRITICAL |
| 2 | Bundle Size Optimization | CRITICAL |
| 3 | Server-Side Performance | HIGH |
| 4 | Client-Side Data Fetching | MEDIUM-HIGH |
| 5 | Re-render Optimization | MEDIUM |
| 6 | Rendering Performance | MEDIUM |
| 7 | JavaScript Performance | LOW-MEDIUM |
| 8 | Advanced Patterns | LOW |

Additional deployment-readiness checks:
- Project structure & file organization
- Server vs client component boundaries
- Environment variable usage
- Type safety
- Error/loading state coverage

---

## Prioritized Audit Plan

| # | Group | Scope | Status |
|---|-------|-------|--------|
| 1 | **Core Infrastructure** | Root layout, middleware, providers, contexts, next.config, vercel.json, package.json | ✅ Complete |
| 2 | **Bookings** | `app/bookings/`, `components/bookings/`, `lib/bookings/`, `api/bookings/` | ✅ Complete |
| 3 | **Scheduler** | `app/scheduler/`, `components/scheduler/`, `lib/scheduler/` | ✅ Complete |
| 4 | **Invoices & Xero** | `app/invoices/`, `components/invoices/`, `lib/invoices/`, `lib/xero/`, `api/xero/`, `api/invoices/` | ✅ Complete |
| 5 | **Members** | `app/members/`, `components/members/`, `lib/members/`, `api/members/` | ✅ Complete |
| 6 | **Dashboard** | `app/dashboard/`, `components/dashboard/`, `lib/dashboard/` | ✅ Complete |
| 7 | **Aircraft** | `app/aircraft/`, `components/aircraft/`, `lib/aircraft/`, `api/aircraft/` | ✅ Complete |
| 8 | **Settings** | `app/settings/`, `components/settings/`, `lib/settings/`, `api/settings/` | ✅ Complete |
| 9 | **Training** | `app/training/`, `components/training/`, `lib/training/` | ✅ Complete |
| 10 | **Equipment** | `app/equipment/`, `components/equipment/`, `lib/equipment/`, `api/equipment/` | ✅ Complete |
| 11 | **Instructors** | `app/instructors/`, `components/instructors/`, `lib/instructors/`, `api/instructors/` | ✅ Complete |
| 12 | **Rosters** | `app/rosters/`, `components/rosters/`, `lib/rosters/` | ✅ Complete |
| 13 | **Reports** | `app/reports/`, `components/reports/`, `lib/reports/` | ✅ Complete |
| 14 | **Auth & Onboarding** | `app/login/`, `app/signup/`, `app/auth/`, `lib/auth/`, `components/auth/` | ✅ Complete |
| 15 | **Shared UI & Utilities** | `components/ui/`, `components/loading/`, `lib/utils/`, `lib/types/` | ✅ Complete |

---

## Early Observations (pre-audit)

These were spotted during the initial repository inspection:

1. **Root layout waterfall (CRITICAL):** `layout.tsx` has three sequential awaits — `createSupabaseServerClient()` → `getAuthSession()` → `fetchUserProfile()` → tenant timezone query. Some of these can be parallelised.
2. **Empty next.config.ts:** No optimizations configured (no `images`, no `experimental` flags, no `serverExternalPackages`).
3. **Two icon libraries:** Both `@tabler/icons-react` and `lucide-react` are in dependencies — potential bundle bloat.
4. **Heavy client bundle candidates:** `@react-pdf/renderer`, `recharts`, `@dnd-kit/*` should be dynamically imported.
5. **No `loading.tsx` or Suspense boundaries** in the root layout — streaming opportunity missed.

---

## Group 1: Core Infrastructure

**Status:** ✅ Complete  
**Files reviewed:**
- `app/layout.tsx`
- `middleware.ts`
- `next.config.ts`
- `vercel.json`
- `package.json`
- `contexts/auth-context.tsx`
- `contexts/timezone-context.tsx`
- `components/providers/react-query-provider.tsx`
- `components/layouts/app-route-shell.tsx`
- `app/page.tsx`
- `app/not-found.tsx`
- `app/dashboard/page.tsx`
- `lib/supabase/server.ts`
- `lib/supabase/env.ts`
- `lib/auth/session.ts`
- `lib/auth/user-profile.ts`
- `lib/auth/display-name.ts`
- `app/actions/auth.ts`
- `app/bookings/actions.ts`
- `app/api/bookings/options/route.ts`

### Findings

#### CRITICAL — Eliminating Waterfalls

| # | Issue | File | Severity | Fixed? |
|---|-------|------|----------|--------|
| 1 | **Root layout sequential fetches**: `fetchUserProfile()` and tenant timezone query ran sequentially after `getAuthSession()`. They are independent and can be parallelized. | `app/layout.tsx` | CRITICAL | ✅ |
| 2 | **Bookings options API waterfall**: Members query ran after the initial `Promise.all()` block of 5 queries. It can be started in parallel with the others. | `app/api/bookings/options/route.ts` | CRITICAL | ✅ |

#### CRITICAL — Bundle Size

| # | Issue | File | Severity | Fixed? |
|---|-------|------|----------|--------|
| 3 | **Two icon libraries**: Both `@tabler/icons-react` and `lucide-react` in dependencies. Each library adds significant JS; consolidating to one would reduce bundle. | `package.json` | HIGH | ⚠️ Deferred (cross-cutting, needs full codebase audit to identify all usage) |
| 4 | **Heavy dependencies not dynamically imported**: `@react-pdf/renderer` (~large), `recharts`, `@dnd-kit/*` are statically bundled. Should use `next/dynamic` for conditional loading. | `package.json` | HIGH | ⚠️ Will audit in relevant feature groups |

#### HIGH — Server-Side Performance

| # | Issue | File | Severity | Fixed? |
|---|-------|------|----------|--------|
| 5 | **`@react-pdf/renderer` not externalized**: Heavy server-only package should be in `serverExternalPackages` to avoid bundling into serverless functions. | `next.config.ts` | HIGH | ✅ |
| 6 | **No image format optimization**: `next.config.ts` had no image configuration. Added AVIF/WebP support. | `next.config.ts` | MEDIUM | ✅ |

#### MEDIUM — Re-render Optimization

| # | Issue | File | Severity | Fixed? |
|---|-------|------|----------|--------|
| 7 | `AuthProvider` context value properly memoized with `useMemo`. | `contexts/auth-context.tsx` | — | ✅ Already correct |
| 8 | `TimezoneProvider` properly memoized. | `contexts/timezone-context.tsx` | — | ✅ Already correct |
| 9 | `ReactQueryProvider` correctly uses lazy state initialization for QueryClient. | `components/providers/react-query-provider.tsx` | — | ✅ Already correct |
| 10 | `AppSidebar` uses `useMemo` for filtered nav items. | `components/app-sidebar.tsx` | — | ✅ Already correct |

#### Positive Patterns (already compliant)

- **Middleware**: Clean, focused auth + role-based redirects with proper matcher config. No waterfalls.
- **Server actions**: Properly authenticate with `requireUser: true` before mutations (`server-auth-actions` rule). ✅
- **Dashboard page**: Uses `React.Suspense` with a skeleton fallback around async `DashboardContent` component — good streaming pattern (`async-suspense-boundaries` rule). ✅
- **API routes**: `bookings/options` correctly uses `Promise.all()` for 5 parallel Supabase queries (`async-parallel` rule). ✅ (Now 6 with the members fix.)
- **Environment variables**: Properly validated with helpful error messages; `NEXT_PUBLIC_` prefix used correctly for client-safe vars. ✅
- **Vercel config**: Region set to `syd1`. ✅
- **`suppressHydrationWarning`**: On `<html>` for framework compatibility; on `<body>` — should verify no real mismatches are being suppressed.

### Changes Made

1. **`app/layout.tsx`**: Parallelized `fetchUserProfile()` and tenant timezone query using `Promise.all()`. Eliminates ~1 network round-trip of latency on every page load.
2. **`app/api/bookings/options/route.ts`**: Moved members query into the `Promise.all()` block so it runs in parallel with aircraft, instructors, flight types, syllabi, and lessons queries. Eliminates a sequential waterfall.
3. **`next.config.ts`**: Added `serverExternalPackages: ["@react-pdf/renderer"]` and `images.formats: ["image/avif", "image/webp"]`.

### Remaining Concerns

- **Icon library consolidation** (`@tabler/icons-react` vs `lucide-react`): Needs a cross-cutting audit to determine which to keep. Will track this as a global concern.
- **Dynamic imports for heavy components** (`recharts`, `@dnd-kit`, `@react-pdf/renderer` on client): Will audit in respective feature groups (Dashboard, Settings/Training, Invoices).
- **`suppressHydrationWarning` on `<body>`**: Verify this isn't masking real hydration mismatches.
- **No `React.cache()` for `createSupabaseServerClient()`**: Multiple calls per request create multiple clients. Could deduplicate with `React.cache()`, but since each call is lightweight (just wraps cookies), the benefit is marginal.

---

## Group 2: Bookings

**Status:** ✅ Complete  
**Files reviewed:**
- `app/bookings/page.tsx`, `app/bookings/[id]/page.tsx`, `app/bookings/checkin/[id]/page.tsx`, `app/bookings/checkout/[id]/page.tsx`, `app/bookings/[id]/debrief/page.tsx`
- `app/bookings/actions.ts`
- `app/api/bookings/route.ts`, `app/api/bookings/options/route.ts`, `app/api/bookings/availability/route.ts`
- `app/api/bookings/[id]/route.ts`, `app/api/bookings/[id]/checkin/approve/route.ts`
- `lib/bookings/create-booking.ts`, `lib/bookings/fetch-booking-page-data.ts`, `lib/bookings/fetch-bookings.ts`, `lib/bookings/fetch-booking-checkout-warnings.ts`, `lib/bookings/resource-availability.ts`, `lib/bookings/navigation.ts`
- `components/bookings/bookings-page-client.tsx`, `components/bookings/booking-detail-client.tsx`, `components/bookings/booking-checkout-client.tsx`

### Findings

#### CRITICAL — Eliminating Waterfalls

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **Sequential validation waterfall**: 5 independent validation queries (aircraft, instructor, member, flight_type, lesson) ran one after another. Parallelized with `Promise.all()`. | `lib/bookings/create-booking.ts` | ✅ |
| 2 | **Sequential booking + tenant timezone**: Booking fetch and tenant timezone query were sequential. Now parallelized. | `lib/bookings/fetch-booking-checkout-warnings.ts` | ✅ |
| 3 | **Sequential settings fetches**: `fetchInvoicingSettings` and `fetchXeroSettings` ran sequentially after RPC. Now parallelized. | `app/api/bookings/[id]/checkin/approve/route.ts` | ✅ |
| 4 | **Sequential PATCH validation**: Aircraft check, instructor check, and availability check ran sequentially. All three now run in parallel. | `app/api/bookings/[id]/route.ts` | ✅ |

#### MEDIUM — Re-render Optimization

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 5 | **`isDirty` not memoized**: Computed with `JSON.stringify` on every render without `useMemo`. Now wrapped in `useMemo`. | `components/bookings/booking-checkout-client.tsx` | ✅ |

#### Positive Patterns Already Compliant

- **All pages use Suspense + skeleton fallbacks** for streaming. (`async-suspense-boundaries`) ✅
- **`fetchBookingPageData`** parallelizes booking + options + audit logs with `Promise.all()`. (`async-parallel`) ✅
- **`fetchOptions`** runs 11 queries in parallel. (`async-parallel`) ✅
- **`fetchAuditLogs`** collects IDs first, then runs batch lookups in parallel using `Promise.all()` + conditional `Set`-based skipping. (`js-set-map-lookups`, `async-parallel`) ✅
- **`fetchBookingCheckoutWarnings`** runs 6 conditional queries in parallel. ✅
- **Checkout page** parallelizes `fetchBookingPageData` + `fetchBookingCheckoutWarnings`. ✅
- **Server actions** authenticate with `requireUser: true` before mutations. (`server-auth-actions`) ✅
- **`BookingsPageClient`** properly memoizes search filtering, tab counts, filtered bookings, and callbacks. (`rerender-memo`, `rerender-functional-setstate`) ✅
- **`BookingCheckoutClient`** uses `useTransition` for mutations. (`rerender-transitions`) ✅
- **`BookingDetailClient`** uses `useMemo` for `isDirty` and `computeAuditEntries` context. ✅
- **`BookingsPageClient`** uses lazy state initialization for `Set`. (`rerender-lazy-state-init`) ✅
- **Conditional rendering** uses `? null` pattern throughout. (`rendering-conditional-render`) ✅
- **Client-side warnings refresh** uses `AbortController` for cleanup. ✅

### Changes Made

1. **`lib/bookings/create-booking.ts`**: Parallelized 5 independent validation queries into a single `Promise.all()`. Eliminates up to 4 sequential round-trips.
2. **`lib/bookings/fetch-booking-checkout-warnings.ts`**: Parallelized booking fetch and tenant timezone query. Saves 1 round-trip.
3. **`app/api/bookings/[id]/checkin/approve/route.ts`**: Parallelized `fetchInvoicingSettings` and `fetchXeroSettings`. Saves 1 round-trip.
4. **`app/api/bookings/[id]/route.ts`**: Parallelized aircraft validation, instructor validation, and availability check into a single `Promise.all()`. Eliminates 2 sequential round-trips.
5. **`components/bookings/booking-checkout-client.tsx`**: Wrapped `isDirty` in `useMemo` to avoid unnecessary `JSON.stringify` on every render.

### Remaining Concerns

- **`booking-checkout-client.tsx` complexity**: At 776 lines with extensive state management, 4 ref-sync effects, and complex derived state. Consider extracting form state into a custom hook for maintainability (not a performance concern per se).
- **`booking-detail-client.tsx` — `computeAuditEntries` in `AuditTimeline`**: Called directly inside the component without `useMemo`. Low priority since audit logs don't change frequently.
- **`create-booking.ts` — Sequential roster rule check**: After the parallelized validations, the roster rules check (lines 163+) runs sequentially. This is correct since it depends on the instructor being validated first.
- **Heavy icon imports** (`@tabler/icons-react`): `booking-detail-client.tsx` imports 17 icons. Tree-shaking should handle this, but is tracked as a global concern.

---

## Group 3: Scheduler

**Status:** ✅ Complete  
**Files reviewed:**
- `app/scheduler/page.tsx`
- `components/scheduler/resource-timeline-scheduler.tsx` (2133 lines)
- `components/scheduler/new-booking-modal.tsx` (2038 lines)
- `components/scheduler/scheduler-page-client.tsx`
- `components/scheduler/scheduler-utils.ts`
- `lib/scheduler/fetch-scheduler-page-data.ts`
- `lib/scheduler/timeline.ts`
- `lib/scheduler/timezone.ts`

### Findings

#### CRITICAL — Bundle Size Optimization

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **Three heavy modals statically imported**: `NewBookingModal` (2038 lines), `CancelBookingModal`, and `ContactDetailsModal` were eagerly loaded into the scheduler bundle. These only render on user interaction. Converted to `next/dynamic` with `ssr: false`. | `resource-timeline-scheduler.tsx` | ✅ |

#### Positive Patterns Already Compliant

- **`fetchSchedulerPageData`**: Two-stage parallel fetching — first `Promise.all()` for bookings, aircraft, roster rules, tenant settings; second `Promise.all()` for instructors + aircraft warnings (depends on first batch). Correctly structured. (`async-parallel`) ✅
- **Scheduler page**: Uses `React.Suspense` with loading fallback for streaming. (`async-suspense-boundaries`) ✅
- **`Intl.DateTimeFormat` caching**: Module-level `Map` caches for formatters, avoiding expensive re-creation. (`js-cache-function-results`) ✅
- **`TIME_OPTIONS` constant**: Computed once via IIFE at module level. (`advanced-init-once`) ✅
- **Extensive `useMemo`**: `timelineConfig`, `slots`, `instructorResources`, `aircraftResources`, `bookings`, `bookingsById`, `instructorAvailabilityById`, `instructorResourceById`, `aircraftResourceById` — all properly memoized. ✅
- **Extensive `useCallback`**: All event handlers wrapped in `useCallback` with correct dependencies. ✅
- **`useRef` for transient drag state**: `dragCandidateRef`, `dragPreviewRef`, `didDragRef`, `suppressBookingOpenRef` — prevents unnecessary re-renders during drag operations. (`rerender-use-ref-transient-values`) ✅
- **`useTransition` for navigation**: Date changes use `startNavigation` transition. (`rerender-transitions`) ✅
- **`Set` for O(1) lookups**: `unavailableAircraftSet`, `unavailableInstructorSet` in new-booking-modal. (`js-set-map-lookups`) ✅
- **`AbortController` for cleanup**: Options fetch, availability fetch, and member training peek all use `AbortController`. ✅
- **Conditional rendering**: Uses `? null` pattern throughout. (`rendering-conditional-render`) ✅
- **`NewBookingModal`**: Uses functional `setForm` updates and `useCallback` for `updateForm`. (`rerender-functional-setstate`) ✅

### Changes Made

1. **`components/scheduler/resource-timeline-scheduler.tsx`**: Converted `CancelBookingModal`, `ContactDetailsModal`, and `NewBookingModal` from static imports to `next/dynamic` with `ssr: false`. These three modals are only shown on user interaction, so deferring their load reduces the initial scheduler bundle significantly.

### Remaining Concerns

- **File size**: `resource-timeline-scheduler.tsx` (2133 lines) and `new-booking-modal.tsx` (2038 lines) are very large. Consider extracting sub-components (e.g., `AircraftWarningTooltip`, booking pill rendering, date navigation) into separate files for maintainability, though this is not a performance concern.
- **`TimelineRow` not memoized**: Could benefit from `React.memo`, but the inline arrow function props (`isSlotAvailable`, `onEmptyClick`, `onStatusUpdate`) would defeat memoization without a larger refactoring to stabilize those references. Low-priority since row count is typically small (< 20).
- **Dual icon library**: Scheduler uses `lucide-react` while sidebar/bookings use `@tabler/icons-react`. Tracked as a global concern.

---

## Group 4: Invoices & Xero

**Status:** ✅ Complete  
**Files reviewed:**
- `app/invoices/page.tsx`
- `app/invoices/new/page.tsx`
- `app/invoices/[id]/page.tsx`
- `app/invoices/[id]/actions.ts`
- `app/invoices/new/actions.ts`
- `app/api/invoices/[id]/route.ts`
- `app/api/xero/export-invoices/route.ts`
- `lib/invoices/fetch-invoices.ts`
- `lib/invoices/fetch-invoice-detail.ts`
- `lib/invoices/fetch-invoice-create-data.ts`
- `lib/invoices/fetch-invoicing-settings.ts`
- `lib/invoices/invoice-service.ts`
- `lib/xero/export-invoice.ts`
- `lib/xero/get-xero-client.ts`
- `components/invoices/invoices-page-client.tsx`
- `components/invoices/invoice-detail-client.tsx`
- `components/invoices/invoice-create-client.tsx`
- `components/invoices/invoice-view-actions.tsx`
- `components/invoices/invoice-document-view.tsx`
- `components/invoices/invoice-report-pdf.tsx`
- `components/invoices/invoices-table.tsx`
- `components/invoices/xero-export-button.tsx`
- `components/invoices/xero-bulk-export-button.tsx`

### Findings

#### CRITICAL — Eliminating Waterfalls

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **Invoice detail page: 3 sequential independent fetches** — `fetchInvoiceDetail`, `fetchInvoicingSettings`, and `fetchXeroSettings` all ran sequentially but are independent of each other. | `app/invoices/[id]/page.tsx` | ✅ |
| 2 | **Invoice list page: xero settings + invoices sequential** — `fetchXeroSettings` blocked `fetchInvoices`. Now parallelized (always pass `xeroEnabled=true` and resolve actual flag in parallel). | `app/invoices/page.tsx` | ✅ |
| 3 | **Invoice detail fetch: invoice + items sequential** — Invoice and items queries ran sequentially despite both using `invoiceId` directly. | `lib/invoices/fetch-invoice-detail.ts` | ✅ |
| 4 | **Create invoice action: 5 sequential independent queries** — Member validation, tax rates, invoicing settings, xero settings, and chargeables all ran sequentially. | `app/invoices/new/actions.ts` | ✅ |

#### CRITICAL — Bundle Size Optimization

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 5 | **`@react-pdf/renderer` eagerly bundled via static import** — `InvoiceReportPDF` was statically imported, pulling the entire PDF rendering library into the client bundle. Now dynamically imported alongside `@react-pdf/renderer` only when user clicks "Download PDF". | `components/invoices/invoice-view-actions.tsx` | ✅ |
| 6 | **Modals statically imported** — `RecordPaymentModal` and `VoidAndReissueModal` only render on user interaction. Converted to `next/dynamic`. | `components/invoices/invoice-view-actions.tsx` | ✅ |

#### Positive Patterns Already Compliant

- **`fetchInvoiceCreateData`**: Already uses `Promise.all()` for members, chargeables, and tax rates. ✅
- **`fetchInvoicingSettings`**: Already uses `Promise.all()` for tenant + tenant_settings. ✅
- **`exportInvoiceToXero`**: Uses `Promise.all()` for xero settings, invoicing settings, and items. ✅
- **Xero bulk export**: Batched concurrency with `EXPORT_CONCURRENCY = 3`. ✅
- **Suspense boundaries**: All invoice pages use `React.Suspense` with skeleton fallbacks. ✅
- **Zod validation**: Server actions validate inputs with Zod schemas. ✅
- **`Set` for O(1) lookups**: `validCodes` Set in export-invoice, `XERO_EXPORTABLE` Set in view-actions. ✅
- **`Map` for lookups**: `chargeableMap`, `chargeableTypeById`, `statusMap` in fetch-invoices. ✅
- **`useTransition`**: Used for approve action and Xero export button. ✅
- **`useMemo`/`useCallback`**: Proper memoization in `invoices-page-client.tsx`. ✅
- **Server-only imports**: `fetch-invoices.ts`, `fetch-invoice-detail.ts`, `fetch-invoicing-settings.ts` all use `import "server-only"`. ✅
- **RoleGuard**: All invoice pages are protected by role-based access control. ✅
- **Idempotency key**: Xero export uses idempotency key to prevent duplicate exports. ✅

### Changes Made

1. **`app/invoices/[id]/page.tsx`**: Parallelized `fetchInvoiceDetail`, `fetchInvoicingSettings`, and `fetchXeroSettings` using `Promise.all()`.
2. **`app/invoices/page.tsx`**: Parallelized `fetchXeroSettings` and `fetchInvoices` by always passing `xeroEnabled=true` to the invoices fetch and resolving the xero flag in parallel.
3. **`lib/invoices/fetch-invoice-detail.ts`**: Parallelized invoice and items queries using `Promise.all()` since both use the input `invoiceId` directly.
4. **`app/invoices/new/actions.ts`**: Parallelized 5 independent queries (member validation, tax rates, invoicing settings, xero settings, chargeables) into a single `Promise.all()`.
5. **`components/invoices/invoice-view-actions.tsx`**: Converted `InvoiceReportPDF` from static import to parallel dynamic import (`import("@react-pdf/renderer")` + `import("@/components/invoices/invoice-report-pdf")`). Converted `RecordPaymentModal` and `VoidAndReissueModal` to `next/dynamic` with `ssr: false`.

### Remaining Concerns

- **Duplicate `pickMaybeOne` helper**: Defined in both `fetch-invoices.ts` and `fetch-invoice-detail.ts`. Could be extracted to a shared utility.
- **`fetchInvoices` does client-side filtering after DB query**: The `matchSearch` and `matchStatus` filters happen post-fetch. For large datasets, this should move to the database query. Low-priority since the initial query already filters by tenant, date, and status.
- **Dual icon libraries**: `invoices-table.tsx` uses `@tabler/icons-react` while `invoice-view-actions.tsx` uses `lucide-react`. Tracked as global concern.

---

## Group 5: Members

**Status:** ✅ Complete  
**Files reviewed:**
- `app/members/page.tsx`
- `app/members/[id]/page.tsx`
- `app/members/actions.ts`
- `app/api/members/route.ts`
- `app/api/members/[id]/access/route.ts`
- `app/api/members/[id]/access/invite/route.ts`
- `app/api/members/[id]/contact-details/route.ts`
- `app/api/members/[id]/flight-history/route.ts`
- `app/api/members/[id]/training/route.ts`
- `app/api/members/[id]/training/overview/route.ts`
- `app/api/members/[id]/training/enrollments/route.ts`
- `lib/members/fetch-members.ts`
- `lib/members/fetch-member-detail.ts`
- `lib/members/fetch-member-pilot-data.ts`
- `lib/members/fetch-member-memberships-data.ts`
- `lib/members/fetch-member-contact-details.ts`
- `components/members/member-detail-client.tsx`
- `components/members/members-page-client.tsx`

### Findings

#### CRITICAL — Bundle Size Optimization

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **7 tab components statically imported**: `MemberDetailClient` imports all 8 tab components (3152 lines total) but only one is visible at a time. Default tab is "contact" — the other 7 tabs may never be visited. Converted non-default tabs to `next/dynamic`. | `components/members/member-detail-client.tsx` | ✅ |
| 2 | **`AddMemberModal` statically imported**: Only opens on button click. Converted to `next/dynamic`. | `components/members/members-page-client.tsx` | ✅ |

#### CRITICAL — Eliminating Waterfalls

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 3 | **Member access API: 3 sequential queries** — `users` lookup, `tenant_users` lookup, and `roles` lookup ran sequentially but are all independent. Parallelized with `Promise.all()`. | `app/api/members/[id]/access/route.ts` | ✅ |
| 4 | **Member creation API: role + user lookups sequential** — `roles` lookup and `users` email check ran sequentially but are independent. Parallelized. | `app/api/members/route.ts` | ✅ |
| 5 | **Invite API: member + tenant_user sequential** — `users` lookup and `tenant_users` lookup ran sequentially. Parallelized. | `app/api/members/[id]/access/invite/route.ts` | ✅ |
| 6 | **Enrollment creation: 4 sequential validation queries** — Tenant timezone, syllabus, instructor, and aircraft_type validations ran sequentially. All parallelized into a single `Promise.all()`. | `app/api/members/[id]/training/enrollments/route.ts` | ✅ |

#### Positive Patterns Already Compliant

- **Members list page**: Uses `React.Suspense` with skeleton fallback. `fetchMembers` parallelizes memberships + instructors in `Promise.all()` after initial tenant_users fetch (correct — needs userIds first). ✅
- **Member detail page**: `MemberDetailContent` parallelizes `fetchMemberDetail`, `fetchMemberPilotData`, `fetchMemberMembershipsData` in `Promise.all()`. ✅
- **`fetchMemberDetail`**: Parallelizes memberships, instructor, and auth user checks. ✅
- **`fetchMemberPilotData`**: Parallelizes licenses, endorsements, and user endorsements in `Promise.all()`. ✅
- **`fetchMemberMembershipsData`**: Parallelizes 4 independent queries (memberships, types, tax, settings). ✅
- **`MembersPageClient`**: Properly uses `useMemo` for tab counts and filtered members, `useCallback` for handlers, `useTransition` for refresh. ✅
- **`MemberDetailClient`**: Uses `useMemo` for tab items, `useRef` for transient tab state. ✅
- **Training API routes**: `training/route.ts` and `training/overview/route.ts` both use `Promise.all()` for parallel fetches. ✅
- **Server actions**: All properly authenticate with `requireTenantContext()`, validate with Zod, and call `revalidatePath()`. ✅
- **`server-only` imports**: All lib/members fetch functions use `import "server-only"`. ✅
- **Error/loading states**: Both `app/members/error.tsx` and `app/members/loading.tsx` exist, plus `[id]/error.tsx` and `[id]/loading.tsx`. ✅
- **Role-based access**: Members list is guarded by `RoleGuard` for owner/admin/instructor. API routes check roles. ✅
- **`Map` for O(1) lookups**: `fetchMembers` uses `Map` for membership-by-user and instructor-by-user. ✅

### Changes Made

1. **`components/members/member-detail-client.tsx`**: Converted 7 tab components (`MemberAccountAccessTab`, `MemberFinances`, `MemberFlightHistoryTab`, `MemberMemberships`, `MemberPilotDetails`, `MemberTrainingTab`, `MemberUpcomingBookingsTable`) from static imports to `next/dynamic` with `ssr: false`. Only `MemberContactDetails` (the default tab) remains statically imported.
2. **`components/members/members-page-client.tsx`**: Converted `AddMemberModal` to `next/dynamic` with `ssr: false`.
3. **`app/api/members/[id]/access/route.ts`**: Parallelized user lookup, tenant_user lookup, and roles query into a single `Promise.all()`.
4. **`app/api/members/route.ts`**: Parallelized role resolution and existing user email lookup into `Promise.all()`.
5. **`app/api/members/[id]/access/invite/route.ts`**: Parallelized user lookup and tenant_user lookup.
6. **`app/api/members/[id]/training/enrollments/route.ts`**: Parallelized tenant timezone, syllabus, instructor, and aircraft_type validation queries into a single `Promise.all()`.

### Remaining Concerns

- **Duplicate `pickMaybeOne` helper**: Defined in `fetch-member-detail.ts`, `fetch-members.ts`, `fetch-member-pilot-data.ts`, `fetch-member-memberships-data.ts`, and `fetch-member-contact-details.ts`. Should be extracted to a shared utility (tracked as global concern from Group 4 as well).
- **`member-detail-client.tsx` size**: At 525 lines with 8 tabs, complex underline animation, and scroll state management. Consider extracting the tab container logic into a reusable component.
- **Member detail page minor waterfall**: `fetchTenantTimezone` runs sequentially before the 3-way `Promise.all()`. The timezone is needed by `fetchMemberMembershipsData`. Since the timezone query is a simple PK lookup (~5ms), this is acceptable. To eliminate it entirely, `fetchMemberMembershipsData` would need to accept timezone post-hoc.
- **`auth.admin.listUsers` fallback in access route**: Falls back to listing up to 1000 auth users — could be slow for large tenants. Consider caching or a more targeted lookup.

---

## Group 6: Dashboard

**Status:** ✅ Complete  
**Files reviewed:**
- `app/dashboard/page.tsx`
- `app/dashboard/loading.tsx`
- `app/dashboard/error.tsx`
- `lib/dashboard/fetch-dashboard-page-data.ts`
- `components/dashboard/dashboard-page-client.tsx`
- `components/dashboard/dashboard-stat-cards.tsx`
- `components/dashboard/flying-now-card.tsx`
- `components/dashboard/upcoming-today-card.tsx`
- `components/dashboard/booking-requests-card.tsx`
- `components/dashboard/booking-status-badge.tsx`
- `components/dashboard/dashboard-page-skeleton.tsx`

### Findings

#### CRITICAL — Eliminating Waterfalls

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **Sequential dashboard data fetches** — booking requests, flying bookings, today's schedule, and monthly metrics were executed one after another even though they are independent once timezone/day boundaries are known. | `lib/dashboard/fetch-dashboard-page-data.ts` | ✅ |

#### HIGH — Server-Side Performance

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 2 | **Unnecessary observations query when fleet is empty** — observations query used a synthetic UUID sentinel when there were no aircraft rows. | `lib/dashboard/fetch-dashboard-page-data.ts` | ✅ |

#### Positive Patterns Already Compliant

- **Page streaming**: `app/dashboard/page.tsx` uses `React.Suspense` with `DashboardPageSkeleton`. ✅
- **Auth and tenant gating**: Dashboard route requires authenticated user and tenant context before rendering. ✅
- **Error/loading boundaries**: Dedicated `app/dashboard/error.tsx` and `app/dashboard/loading.tsx` provide resilient UX. ✅
- **Type-safe dashboard contract**: `DashboardPageClient` accepts typed `DashboardData` and keeps server/client concerns separated. ✅
- **Metric query batching**: Monthly metric sub-queries already used `Promise.all()` internally. ✅
- **Efficient lookups**: `Set`/`Map` usage for active students and observation counts is appropriate. ✅

### Changes Made

1. **`lib/dashboard/fetch-dashboard-page-data.ts`**: Started and awaited four independent fetch groups in parallel (`booking requests`, `flying now`, `upcoming today`, and `monthly metrics`) instead of sequential execution. This removes three serial network waits on dashboard load.
2. **`lib/dashboard/fetch-dashboard-page-data.ts`**: Skipped the `observations` query entirely when no aircraft IDs exist, removing unnecessary database work and removing reliance on sentinel UUID values.

### Remaining Concerns

- **Repeated date formatter instantiation in client cards**: `flying-now-card.tsx`, `upcoming-today-card.tsx`, and `booking-requests-card.tsx` instantiate `Intl.DateTimeFormat` inside per-row helper calls. This is minor at current list sizes but should be hoisted/memoized if card limits grow.
- **`dashboard-stat-cards.tsx` is client-rendered** despite fully deterministic server-provided data. Potential follow-up: evaluate converting to a server component if interactivity/tooltips are not required there.
- **Dual icon library concern still applies** (`@tabler/icons-react` and `lucide-react`) as a cross-cutting bundle-size risk.

---

## Group 7: Aircraft

**Status:** ✅ Complete  
**Files reviewed:**
- `app/aircraft/page.tsx`
- `app/aircraft/[id]/page.tsx`
- `app/aircraft/loading.tsx`
- `app/aircraft/error.tsx`
- `app/aircraft/[id]/loading.tsx`
- `app/aircraft/[id]/error.tsx`
- `lib/aircraft/fetch-aircraft.ts`
- `lib/aircraft/fetch-aircraft-detail.ts`
- `lib/aircraft/fetch-aircraft-tech-log.ts`
- `lib/aircraft/fetch-aircraft-warning-summaries.ts`
- `app/api/aircraft/route.ts`
- `app/api/aircraft/[id]/route.ts`
- `app/api/aircraft/reorder/route.ts`
- `app/api/aircraft/[id]/tech-log/route.ts`
- `components/aircraft/aircraft-table.tsx`
- `components/aircraft/aircraft-detail-client.tsx`
- `components/aircraft/aircraft-overview-tab.tsx`
- `components/aircraft/aircraft-tech-log-tab.tsx`
- `components/aircraft/aircraft-flight-history-tab.tsx`
- `components/aircraft/aircraft-observations-tab.tsx`
- `components/aircraft/aircraft-observations-table.tsx`
- `components/aircraft/aircraft-maintenance-items-tab.tsx`
- `components/aircraft/aircraft-maintenance-history-tab.tsx`
- `components/aircraft/aircraft-settings-tab.tsx`
- `components/aircraft/add-aircraft-modal.tsx`
- `components/aircraft/reorder-aircraft-modal.tsx`
- `components/aircraft/log-maintenance-modal.tsx`
- `components/aircraft/component-new-modal.tsx`

### Findings

#### CRITICAL — Bundle Size Optimization

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **Aircraft list modals eagerly bundled** — `AddAircraftModal` and `ReorderAircraftModal` were statically imported in the list page client even though both are opened on demand. Converted to `next/dynamic`. | `components/aircraft/aircraft-table.tsx` | ✅ |
| 2 | **Aircraft detail tabs eagerly bundled** — six non-default tab components were statically imported in the detail client and bundled up front. Converted to `next/dynamic` so only default `overview` stays eager. | `components/aircraft/aircraft-detail-client.tsx` | ✅ |

#### CRITICAL — Eliminating Waterfalls

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 3 | **Sequential reorder updates** — aircraft reorder endpoint updated each row in a `for` loop (`await` per item). Converted to parallel updates with `Promise.all()`. | `app/api/aircraft/reorder/route.ts` | ✅ |
| 4 | **Sequential create validations** — duplicate registration check and aircraft-type existence check ran sequentially. Parallelized (conditional type check + duplicate check). | `app/api/aircraft/route.ts` | ✅ |

#### Positive Patterns Already Compliant

- **Server page streaming**: both aircraft list and detail pages use `React.Suspense` with dedicated skeletons. ✅
- **Detail data fetch strategy**: `fetch-aircraft-detail.ts` fetches flights/maintenance/observations/components in one `Promise.all()` batch after aircraft existence check. ✅
- **Tech log route and loader**: robust pagination validation with `zod`, `no-store` responses, bounded page size, and timezone normalization in `fetch-aircraft-tech-log.ts`. ✅
- **Warning summaries**: `fetch-aircraft-warning-summaries.ts` batches component/observation/maintenance queries in parallel and uses map/set grouping efficiently. ✅
- **Error/loading boundaries**: list and detail routes include dedicated `loading.tsx` and `error.tsx` coverage. ✅

### Changes Made

1. **`components/aircraft/aircraft-table.tsx`**: Dynamic imported `AddAircraftModal` and `ReorderAircraftModal` with `ssr: false`.
2. **`components/aircraft/aircraft-detail-client.tsx`**: Dynamic imported non-default tabs (`tech-log`, `flight-history`, `observations`, `maintenance-items`, `maintenance-history`, `settings`) with `ssr: false`; kept `overview` static.
3. **`app/api/aircraft/reorder/route.ts`**: Replaced sequential update loop with parallelized `Promise.all()` updates and consolidated error check.
4. **`app/api/aircraft/route.ts`**: Parallelized duplicate registration check and optional aircraft-type validation.

### Remaining Concerns

- **`aircraft-settings-tab.tsx` uses `window.location.reload()` after save**: this is functionally safe but bypasses more efficient refresh patterns and causes a full reload.
- **Large client components** (`aircraft-maintenance-items-tab.tsx`, `aircraft-maintenance-history-tab.tsx`, `aircraft-observations-table.tsx`) remain complex; maintainability concern rather than immediate deployment blocker.
- **Mixed icon libraries** continue across aircraft components (`@tabler/icons-react` and `lucide-react`), still contributing to cross-cutting bundle-size overhead.

---

## Group 8: Settings

**Status:** ✅ Complete  
**Files reviewed:**
- `app/settings/page.tsx`
- `app/settings/loading.tsx`
- `app/settings/error.tsx`
- `components/settings/settings-page-client.tsx`
- `components/settings/general-tab.tsx`
- `components/settings/bookings-tab.tsx`
- `components/settings/charges-tab.tsx`
- `components/settings/training-tab.tsx`
- `components/settings/memberships-tab.tsx`
- `components/settings/invoicing-tab.tsx`
- `components/settings/integrations-tab.tsx`
- `lib/settings/fetch-general-settings.ts`
- `lib/settings/fetch-bookings-settings.ts`
- `lib/settings/fetch-memberships-settings.ts`
- `lib/settings/fetch-invoicing-settings.ts`
- `lib/settings/fetch-xero-settings.ts`
- `app/api/settings/general/route.ts`
- `app/api/settings/bookings/route.ts`
- `app/api/settings/memberships/route.ts`
- `app/api/settings/invoicing/route.ts`
- `app/api/settings/xero/route.ts`

### Findings

#### CRITICAL — Eliminating Waterfalls

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **Settings page sequential server fetches** — general, invoicing, bookings, memberships, and xero settings were fetched one after another, increasing first-load latency. Converted to parallel `Promise.allSettled` fetches with per-section error isolation retained. | `app/settings/page.tsx` | ✅ |

#### CRITICAL — Bundle Size Optimization

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 2 | **Top-level settings tabs eagerly bundled** — non-default tabs (`invoicing`, `charges`, `bookings`, `training`, `memberships`, `integrations`) were statically imported in `SettingsPageClient`. Converted to dynamic imports. | `components/settings/settings-page-client.tsx` | ✅ |
| 3 | **Nested settings tab content eagerly bundled** — several non-default sub-tabs were statically imported in tab containers. Converted these to dynamic imports to reduce initial settings payload. | `components/settings/general-tab.tsx`, `components/settings/bookings-tab.tsx`, `components/settings/charges-tab.tsx`, `components/settings/training-tab.tsx`, `components/settings/memberships-tab.tsx` | ✅ |

#### Positive Patterns Already Compliant

- **Role protection**: settings page and settings APIs consistently enforce admin/owner access via authenticated role checks. ✅
- **Server fetch helpers**: settings fetch utilities are strongly typed, `server-only`, and consistently normalize defaults. ✅
- **Client save UX**: tabs use `StickyFormActions`, clear dirty-state handling, and toast feedback for save operations. ✅
- **Defensive API responses**: most settings APIs use `cache-control: no-store`, payload validation via `zod`, and structured error returns. ✅

### Changes Made

1. **`app/settings/page.tsx`**: Parallelized settings and xero-connection data loading with `Promise.allSettled`, preserving independent failure handling per section.
2. **`components/settings/settings-page-client.tsx`**: Dynamic imported all non-default top-level settings tabs (`ssr: false`), keeping only `GeneralTab` static.
3. **`components/settings/general-tab.tsx`**: Dynamic imported non-default `TaxSettingsTab`.
4. **`components/settings/bookings-tab.tsx`**: Dynamic imported non-default `CancellationCategoriesTab`.
5. **`components/settings/charges-tab.tsx`**: Dynamic imported non-default `LandingFeesConfig`, `ChargeableTypesConfig`, `ChargeablesConfig`.
6. **`components/settings/training-tab.tsx`**: Dynamic imported non-default `SyllabusConfig`, `LessonsTab`, `ExamsConfig`, `EndorsementsConfig`.
7. **`components/settings/memberships-tab.tsx`**: Dynamic imported non-default `MembershipYearConfig`.

### Remaining Concerns

- **`general-tab.tsx` and `bookings-tab.tsx` complexity**: both files are large and own UI state, tab chrome, and async logic in a single component; maintainability concern.
- **`app/api/settings/general/route.ts` has duplicated business-hours validation branches** (pre- and post-tenant update), which could be simplified for clarity.
- **Cross-cutting icon-library split** (`@tabler/icons-react` and `lucide-react`) continues in settings UI and remains a bundle-size concern.

---

## Group 9: Training

**Status:** ✅ Complete  
**Files reviewed:**
- `app/training/page.tsx`
- `app/training/loading.tsx`
- `app/training/error.tsx`
- `components/training/training-page-client.tsx`
- `components/training/training-student-sheet.tsx`
- `components/training/training-student-overview-tab.tsx`
- `components/training/training-student-flying-tab.tsx`
- `components/training/training-student-debriefs-tab.tsx`
- `components/training/training-student-theory-tab.tsx`
- `components/training/training-student-programme-tab.tsx`
- `lib/training/fetch-training-overview.ts`

### Findings

#### CRITICAL — Bundle Size Optimization

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **Training student sheet eagerly bundled** — the detail sheet (and its tab content) was statically imported in the page client even though it is only needed after selecting a student row. Converted to dynamic import. | `components/training/training-page-client.tsx` | ✅ |
| 2 | **Non-default sheet tabs eagerly bundled** — flying, debriefs, theory, and programme tabs were all statically imported and included in the initial training sheet chunk. Converted to dynamic imports and kept only default `overview` eager. | `components/training/training-student-sheet.tsx` | ✅ |

#### CRITICAL — Eliminating Waterfalls

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 3 | **Sequential independent server queries** — instructor metadata and syllabus lesson totals were fetched one after another in training overview generation. Parallelized with `Promise.all()`. | `lib/training/fetch-training-overview.ts` | ✅ |

#### Positive Patterns Already Compliant

- **Route resilience**: training route includes dedicated `loading.tsx` and `error.tsx` boundaries and preserves role guard + tenant checks. ✅
- **Deferred tab fetching**: heavy tab data requests are already lazy and initiated only when tabs become active (`programme`, `flying`, `debriefs`, `theory`). ✅
- **Client fetch safety**: tab fetchers consistently use `AbortController` patterns and bounded in-memory TTL caches to reduce duplicate requests. ✅
- **Server auth boundaries**: training page continues to use authoritative session checks before loading tenant-scoped training data. ✅

### Changes Made

1. **`components/training/training-page-client.tsx`**: Dynamic imported `TrainingStudentSheet` with `ssr: false` so the detail sheet code only loads when needed.
2. **`components/training/training-student-sheet.tsx`**: Dynamic imported non-default tab components (`flying`, `debriefs`, `theory`, `programme`) with `ssr: false`; kept `overview` static as the default tab.
3. **`lib/training/fetch-training-overview.ts`**: Parallelized independent instructor lookup and lessons lookup using `Promise.all()` before building maps.

### Remaining Concerns

- **`components/training/training-page-client.tsx` remains high-complexity**: it combines filtering, grouping, sorting, table rendering, and sheet orchestration in one large client component.
- **Cross-cutting icon-library split** remains in training UI (`@tabler/icons-react` + `lucide-react`), still a bundle-size concern.
- **`lib/training/fetch-training-overview.ts` chunk loops are still sequential across chunk pairs**; this is safe and bounded, but could become a latency hotspot at larger tenant sizes.

---

## Group 10: Equipment

**Status:** ✅ Complete  
**Files reviewed:**
- `app/equipment/page.tsx`
- `app/equipment/loading.tsx`
- `app/equipment/error.tsx`
- `app/equipment/[id]/page.tsx`
- `app/equipment/[id]/loading.tsx`
- `app/equipment/[id]/error.tsx`
- `app/api/equipment/route.ts`
- `app/api/equipment/[id]/route.ts`
- `components/equipment/equipment-page-client.tsx`
- `components/equipment/equipment-table.tsx`
- `components/equipment/equipment-detail-client.tsx`
- `components/equipment/add-equipment-modal.tsx`
- `components/equipment/issue-equipment-modal.tsx`
- `components/equipment/return-equipment-modal.tsx`
- `components/equipment/equipment-issuance-table.tsx`
- `components/equipment/equipment-updates-table.tsx`
- `components/equipment/update-equipment-modal.tsx`
- `lib/equipment/fetch-equipment.ts`
- `lib/equipment/fetch-equipment-detail.ts`
- `lib/equipment/fetch-equipment-issuance-history.ts`
- `lib/equipment/fetch-equipment-updates-history.ts`
- `lib/equipment/fetch-equipment-issuance-members.ts`

### Findings

#### CRITICAL — Eliminating Waterfalls

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **List page sequential server fetches** — equipment and issuance-members data were fetched one after another when both are needed for staff users. Parallelized with `Promise.allSettled()` while preserving independent error handling. | `app/equipment/page.tsx` | ✅ |
| 2 | **Detail page sequential secondary fetches** — issuance history, update history, and issuance members loaded serially after equipment fetch. Parallelized these independent fetches with `Promise.allSettled()`. | `app/equipment/[id]/page.tsx` | ✅ |

#### CRITICAL — Bundle Size Optimization

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 3 | **List-page action modals eagerly bundled** — add/issue/return modals were statically imported despite being opened on demand. Converted to `next/dynamic` imports (`ssr: false`). | `components/equipment/equipment-page-client.tsx` | ✅ |
| 4 | **Detail non-default tabs + action modals eagerly bundled** — issuance/updates tab content and issue/return modals were statically imported. Converted to `next/dynamic` imports (`ssr: false`). | `components/equipment/equipment-detail-client.tsx` | ✅ |
| 5 | **Log-update modal eagerly bundled in updates tab** — `UpdateEquipmentModal` was statically imported even though it only opens on interaction. Converted to `next/dynamic` import (`ssr: false`). | `components/equipment/equipment-updates-table.tsx` | ✅ |

#### Positive Patterns Already Compliant

- **Auth + role gating**: equipment APIs consistently enforce authenticated tenant access and role checks for create/update/delete operations. ✅
- **Defensive API responses**: route handlers return explicit 4xx/5xx states with `cache-control: no-store`. ✅
- **Page boundaries**: equipment list/detail routes include dedicated loading and error boundaries. ✅
- **Server-side enrichment**: `fetch-equipment.ts` already batches issuance/update lookups with a single `Promise.all()` and efficient map joins. ✅

### Changes Made

1. **`app/equipment/page.tsx`**: Parallelized equipment + issuance-members fetches with `Promise.allSettled()`.
2. **`app/equipment/[id]/page.tsx`**: Parallelized issuance history, updates history, and issuance-members fetches with `Promise.allSettled()`.
3. **`components/equipment/equipment-page-client.tsx`**: Dynamic imported `AddEquipmentModal`, `IssueEquipmentModal`, and `ReturnEquipmentModal`.
4. **`components/equipment/equipment-detail-client.tsx`**: Dynamic imported `EquipmentIssuanceTable`, `EquipmentUpdatesTable`, `IssueEquipmentModal`, and `ReturnEquipmentModal`.
5. **`components/equipment/equipment-updates-table.tsx`**: Dynamic imported `UpdateEquipmentModal`.

### Remaining Concerns

- **`components/equipment/equipment-detail-client.tsx` remains high-complexity**: it owns tab state, form state, update/delete flows, and modal orchestration in one large client component.
- **Cross-cutting icon-library split** continues in equipment UI (`@tabler/icons-react` + `lucide-react`), still contributing to avoidable bundle growth.
- **`isDirty` comparison in detail form uses `JSON.stringify`**; acceptable for current form size, but still a brittle pattern for future nested state growth.

---

## Group 11: Instructors

**Status:** ✅ Complete  
**Files reviewed:**
- `app/instructors/page.tsx`
- `app/instructors/loading.tsx`
- `app/instructors/error.tsx`
- `app/instructors/[id]/page.tsx`
- `app/instructors/[id]/loading.tsx`
- `app/instructors/[id]/error.tsx`
- `app/instructors/actions.ts`
- `app/api/instructors/route.ts`
- `components/instructors/instructors-page-client.tsx`
- `components/instructors/instructors-table.tsx`
- `components/instructors/instructor-detail-client.tsx`
- `components/instructors/instructor-charge-rates-table.tsx`
- `components/instructors/instructor-detail-utils.ts`
- `lib/instructors/fetch-instructors.ts`
- `lib/instructors/fetch-instructor-detail.ts`
- `lib/instructors/fetch-instructor-rates.ts`
- `lib/instructors/fetch-instructor-rate-metadata.ts`
- `lib/instructors/fetch-instructor-categories.ts`

### Findings

#### CRITICAL — Bundle Size Optimization

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **Instructors table eagerly bundled** — list page client always imported the full table implementation even though it is a heavy interactive component. Converted to dynamic import (`ssr: false`). | `components/instructors/instructors-page-client.tsx` | ✅ |
| 2 | **Charge-rates tab eagerly bundled** — instructor detail page imported charge-rates table up front despite it living behind a non-default tab. Converted to dynamic import (`ssr: false`). | `components/instructors/instructor-detail-client.tsx` | ✅ |

#### CRITICAL — Eliminating Waterfalls / Failure Coupling

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 3 | **Detail sub-sections coupled by single `Promise.all`** — one failing request (rates/categories/metadata) blanked all three sections. Switched to `Promise.allSettled()` with per-section assignment and partial render fallback. | `app/instructors/[id]/page.tsx` | ✅ |
| 4 | **Server action validation checks sequential** — instructor existence and flight-type existence checks were independent in rate creation flow. Parallelized with `Promise.all()`. | `app/instructors/actions.ts` | ✅ |
| 5 | **Server actions spawned extra Supabase clients for verification helpers** — helper functions re-created server clients, adding avoidable overhead and duplicated context work. Reused action-scoped client by passing it into helper functions. | `app/instructors/actions.ts` | ✅ |

#### Positive Patterns Already Compliant

- **Route boundaries**: instructors list/detail routes include dedicated loading and error boundaries with graceful fallback states. ✅
- **Auth/role controls**: page-level role guard and API role checks are in place for instructor access flows. ✅
- **Data helper structure**: instructor fetch helpers are server-only and typed, with clear relation shaping. ✅
- **Rate metadata fetching**: `fetch-instructor-rate-metadata.ts` already batches flight-type and default-tax lookups in parallel. ✅

### Changes Made

1. **`components/instructors/instructors-page-client.tsx`**: Dynamic imported `InstructorsTable` (`ssr: false`).
2. **`components/instructors/instructor-detail-client.tsx`**: Dynamic imported `InstructorChargeRatesTable` (`ssr: false`).
3. **`app/instructors/[id]/page.tsx`**: Replaced coupled `Promise.all` block with `Promise.allSettled` for rates/categories/metadata and partial-section fallback handling.
4. **`app/instructors/actions.ts`**: Passed action-scoped Supabase client into instructor/flight-type verification helpers instead of re-creating clients inside helpers.
5. **`app/instructors/actions.ts`**: Parallelized instructor + flight-type validation in `createInstructorRateAction` via `Promise.all`.

### Remaining Concerns

- **`components/instructors/instructor-detail-client.tsx` remains high-complexity**: it still combines tab chrome, detail form state, notes form state, and action orchestration in one large component.
- **Cross-cutting icon-library split** continues in instructor UI (`@tabler/icons-react` + `lucide-react`) and remains a bundle-size concern.
- **`JSON.stringify` dirty checks** are still used for details form equality; safe for now, but brittle as nested state grows.

---

## Group 12: Rosters

**Status:** ✅ Complete  
**Files reviewed:**
- `app/rosters/page.tsx`
- `app/rosters/loading.tsx`
- `app/rosters/error.tsx`
- `app/rosters/actions.ts`
- `components/rosters/rosters-page-client.tsx`
- `components/rosters/roster-scheduler.tsx`
- `components/rosters/roster-shift-modal.tsx`
- `lib/rosters/fetch-roster-page-data.ts`

### Findings

#### CRITICAL — Bundle Size Optimization

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **Heavy scheduler eagerly bundled** — the roster page client statically imported the full scheduler even though this is a large interactive surface. Converted to dynamic import (`ssr: false`). | `components/rosters/rosters-page-client.tsx` | ✅ |
| 2 | **Shift modal eagerly bundled in scheduler** — create/edit modal was statically imported and bundled on initial page load despite being user-triggered. Converted to dynamic import (`ssr: false`). | `components/rosters/roster-scheduler.tsx` | ✅ |

#### Positive Patterns Already Compliant

- **Server fetch batching**: `fetch-roster-page-data.ts` already loads instructors, roster rules, and tenant settings in parallel with `Promise.all`. ✅
- **Role/auth controls**: roster page and server actions enforce authenticated tenant scope and role checks before mutation paths. ✅
- **Conflict validation flow**: roster actions perform overlap checks before create/update and return domain-specific conflict messages. ✅
- **Loading/error boundaries**: dedicated `loading.tsx` and `error.tsx` exist for roster route reliability. ✅

### Changes Made

1. **`components/rosters/rosters-page-client.tsx`**: Dynamic imported `RosterScheduler` (`ssr: false`).
2. **`components/rosters/roster-scheduler.tsx`**: Dynamic imported `RosterShiftModal` (`ssr: false`) so modal code loads only when needed.

### Remaining Concerns

- **`components/rosters/roster-shift-modal.tsx` still performs multi-day create/edit saves sequentially**; this is functionally safe but can feel slower when many days are selected.
- **`components/rosters/roster-scheduler.tsx` remains high-complexity** with timeline math, row rendering, draft/edit orchestration, and modal coordination in one file.
- **Cross-cutting icon-library split** (`lucide-react` + `@tabler/icons-react`) continues in rosters and remains a bundle-size concern.

---

## Group 13: Reports

**Status:** ✅ Complete  
**Files reviewed:**
- `app/reports/page.tsx`
- `app/reports/loading.tsx`
- `app/reports/error.tsx`
- `components/reports/reports-dashboard.tsx`
- `components/reports/date-range-selector.tsx`
- `components/reports/reports-page-client.tsx`
- `lib/reports/fetch-report-data.ts`

### Findings

#### CRITICAL — Bundle Size Optimization

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **Heavy reports dashboard eagerly bundled** — chart-heavy `ReportsDashboard` (Recharts + multiple tab panels) was directly imported in the server page render path. Introduced a lightweight client wrapper and dynamic import (`ssr: false`) so dashboard code is deferred until needed. | `components/reports/reports-page-client.tsx`, `app/reports/page.tsx` | ✅ |

#### HIGH — Server-Side Performance

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 2 | **Observation query over-fetching payload** — reports fetch loaded full observation rows (`id`, `reported_date`, `stage`) for all-time usage even though trends and stage breakdown have different data needs. Split into targeted queries: range-limited trend dates and all-time stage-only rows. | `lib/reports/fetch-report-data.ts` | ✅ |
| 3 | **Minor page-level await waterfall** — `searchParams` and auth session resolution were awaited sequentially. Parallelized with `Promise.all()`. | `app/reports/page.tsx` | ✅ |

#### Positive Patterns Already Compliant

- **Parallel domain fetching**: `fetch-report-data.ts` already batches main domain reads (bookings, aircraft, instructors, training, syllabus, categories) via `Promise.all`. ✅
- **Role + tenant boundaries**: reports route uses role guard plus authenticated tenant session checks before data access. ✅
- **Route resilience**: dedicated `loading.tsx` and `error.tsx` boundaries remain in place for report route stability. ✅

### Changes Made

1. **`components/reports/reports-page-client.tsx`**: Added new client wrapper that dynamically imports `ReportsDashboard` with `ssr: false`.
2. **`app/reports/page.tsx`**: Switched rendering to `ReportsPageClient` and parallelized `searchParams` + auth session resolution.
3. **`lib/reports/fetch-report-data.ts`**: Split observations fetch into two targeted queries (`reported_date` for in-range trends, `stage` for global stage breakdown/open count), reducing over-fetched columns and date scope.

### Remaining Concerns

- **`components/reports/reports-dashboard.tsx` is still a large monolith** containing all tab panels and chart definitions in one file; maintainability concern.
- **Tab panel chart payload remains loaded together** because data is fetched for all tabs at once; acceptable for now but may become expensive for larger tenants.
- **Cross-cutting icon-library split** (`@tabler/icons-react` plus other icon usage elsewhere) remains an ongoing bundle-size concern across the app.

---

## Group 14: Auth & Onboarding

**Status:** ✅ Complete  
**Files reviewed:**
- `app/login/page.tsx`
- `app/signup/page.tsx`
- `app/auth/callback/route.ts`
- `app/auth/invite/accept/route.ts`
- `app/actions/auth.ts`
- `components/auth/role-guard.tsx`
- `components/login-form.tsx`
- `components/signup-form.tsx`
- `lib/auth/session.ts`
- `lib/auth/roles.ts`
- `lib/auth/tenant.ts`
- `lib/auth/user-profile.ts`
- `lib/auth/display-name.ts`
- `lib/auth/route-permissions.ts`

### Findings

#### CRITICAL — Eliminating Waterfalls

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **Auth role/tenant resolution could serialize DB reads** — in claim-miss/authoritative modes, role and tenant lookups were resolved in sequence inside `getAuthSession`. Refactored to run independent DB fallbacks/authoritative lookups in parallel with `Promise.all()`. | `lib/auth/session.ts` | ✅ |
| 2 | **Login page sequential await path** — `searchParams` and auth session were awaited one after another. Parallelized with `Promise.all()` to remove a small server-side wait. | `app/login/page.tsx` | ✅ |

#### HIGH — Auth Flow Robustness / Efficiency

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 3 | **OAuth callback used separate user + tenant checks** — callback flow did `getUser()` then a direct `tenant_users` query. Consolidated through existing auth-session helper with authoritative tenant resolution for consistent behavior and fewer ad-hoc checks. | `app/auth/callback/route.ts` | ✅ |

#### Positive Patterns Already Compliant

- **Route-level protection**: `RoleGuard` consistently enforces allowed roles and login redirects for protected pages. ✅
- **Tenant-aware auth model**: auth utilities separate claim parsing from authoritative DB lookups with explicit strict/fallback controls. ✅
- **Server actions for auth events**: sign-in/sign-up/sign-out operations are centralized and trigger layout revalidation. ✅
- **Invite acceptance flow**: invite callback supports both code-exchange and OTP verification paths with clear failure redirects. ✅

### Changes Made

1. **`lib/auth/session.ts`**: Refactored role + tenant resolution into parallel promise paths when DB fallback/authoritative lookups are required.
2. **`app/login/page.tsx`**: Parallelized `searchParams` resolution with auth session lookup.
3. **`app/auth/callback/route.ts`**: Replaced manual user/tenant lookup sequence with `getAuthSession(..., { includeTenant: true, requireUser: true, authoritativeTenant: true })` and retained existing redirect behavior.

### Remaining Concerns

- **Auth forms are large, highly visual client components** (`components/login-form.tsx`, `components/signup-form.tsx`) with carousel + social UI in single files; maintainability concern.
- **Both auth forms still include static remote image URLs directly in component code**; no optimization hooks for image preloading/fallback behavior.
- **Cross-cutting icon-library split** (`lucide-react` in auth screens vs `@tabler/icons-react` elsewhere) remains an app-wide bundle-size concern.

---

## Group 15: Shared UI & Utilities

**Status:** ✅ Complete  
**Files reviewed:**
- `components/ui/chart.tsx`
- `components/ui/sonner.tsx`
- `components/loading/route-loading-state.tsx`
- `components/loading/route-not-found-state.tsx`
- `lib/utils/membership-utils.ts`
- `lib/utils/date-helpers.ts`
- `lib/types/index.ts`
- `next.config.ts`

### Findings

#### CRITICAL — Bundle Size / Shared Import Cost

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 1 | **Icon package imports were not optimized globally** — shared UI and loading components use `lucide-react` and parts of the app use `@tabler/icons-react`; without package import optimization this can inflate parsed module work and cold-start/build overhead. Added package import optimization in Next config. | `next.config.ts` | ✅ |

#### HIGH — Rendering Correctness / Micro-Perf

| # | Issue | File | Fixed? |
|---|-------|------|--------|
| 2 | **Tooltip value rendering used truthy check (`item.value && ...`)** — this suppresses valid `0` values in charts. Replaced with explicit null/undefined check so zero values render correctly. | `components/ui/chart.tsx` | ✅ |
| 3 | **Toaster recreated icon/style objects on every render** — low-level but unnecessary allocations in a global shared UI primitive. Hoisted these objects to module-level constants. | `components/ui/sonner.tsx` | ✅ |
| 4 | **Membership fee formatter allocated `Intl.NumberFormat` per call** — repeated formatter construction in utility path. Moved to a module-level cached formatter. | `lib/utils/membership-utils.ts` | ✅ |

#### Positive Patterns Already Compliant

- **Shared chart wrapper architecture** in `components/ui/chart.tsx` is clean and composable with context-backed config resolution. ✅
- **Timezone/date utility usage** in membership helpers already relies on date-key utilities instead of ad-hoc local timezone math. ✅
- **Type-only usage from `lib/types`** keeps runtime overhead low for most consumers. ✅

### Changes Made

1. **`next.config.ts`**: Added `experimental.optimizePackageImports` for `lucide-react` and `@tabler/icons-react`.
2. **`components/ui/chart.tsx`**: Fixed tooltip value rendering to correctly display `0` values by replacing a truthy guard with explicit null/undefined handling.
3. **`components/ui/sonner.tsx`**: Hoisted `icons` and `style` objects to module-level constants to avoid recreating object literals each render.
4. **`lib/utils/membership-utils.ts`**: Introduced a module-level `Intl.NumberFormat` instance and reused it in `calculateMembershipFee`.

### Remaining Concerns

- **`components/ui/chart.tsx` still hard-imports `recharts`** as part of shared UI. This is expected for chart routes, but chart-heavy screens should continue using route-level/component-level lazy loading where possible.
- **`lib/utils/date-helpers.ts` appears currently unused** in runtime code (only doc references found); consider deleting or consolidating to reduce utility surface area.
- **`lib/types/index.ts` remains a broad barrel**; runtime impact is low for type imports, but gradual migration to direct imports can improve long-term maintainability and TS compile clarity.
- **Cross-cutting icon-library split** (`lucide-react` + `@tabler/icons-react`) remains an app-wide bundle-size concern despite package import optimization.

---

## Follow-up: Redundant Auth/Role Guard Pass

**Status:** ✅ Complete  
**Context:** Cross-cutting follow-up after Group 8 (Settings) pattern fix.

### Objective

Find and remove route patterns where pages performed auth/session work and then wrapped with `RoleGuard`, causing a second `getAuthSession()` call in the same request path.

### Findings

#### HIGH — Duplicate Auth Resolution Across Pages

| # | Issue | Files | Fixed? |
|---|-------|-------|--------|
| 1 | **Redundant auth/session fetches**: pages resolved user/tenant (and in some cases role) directly, then wrapped the tree in `RoleGuard`, which performs another `getAuthSession()` call. | `app/invoices/page.tsx`, `app/invoices/new/page.tsx`, `app/invoices/[id]/page.tsx`, `app/reports/page.tsx`, `app/rosters/page.tsx`, `app/members/page.tsx`, `app/instructors/page.tsx`, `app/training/page.tsx` | ✅ |

### Changes Made

1. **Removed `RoleGuard` wrappers** from the 8 affected pages above.
2. **Moved role checks into page-level logic** where needed (using existing redirect behavior to `/dashboard`).
3. **Added role resolution to session fetches** in pages that previously only loaded user/tenant:
   - `app/invoices/page.tsx`
   - `app/reports/page.tsx`
   - `app/rosters/page.tsx`
   - `app/members/page.tsx`
   - `app/instructors/page.tsx`
4. **Kept existing access behavior** (owner/admin/instructor restrictions unchanged) while removing duplicate session work.

### Impact

- Reduces avoidable per-request auth/session overhead on high-traffic staff routes.
- Simplifies route control flow by keeping auth + authorization in one place per page.
- Aligns with Vercel performance guidance to avoid repeated server-side work in request render paths.
