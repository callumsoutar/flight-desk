# Production Readiness Review

## 1. Authentication & Authorization

### Summary
- Overall state: improved, but not complete
- The codebase has a reasonable auth foundation: Supabase SSR clients are set up correctly, middleware protects major app routes, and several server paths intentionally use authoritative DB-backed role and tenant resolution.
- The major login redirect issue has been fixed, session bootstrap has been tightened for user-visible auth state, sign-up failure handling now compensates for partial provisioning, and invite type validation has been narrowed.
- Remaining auth work is mainly abuse protection: there is still no durable rate limiting / bot protection layer for public auth endpoints.

### Critical Issues
1. None currently blocking in this section after the applied fixes.

### Improvements
1. Add abuse controls on public auth entrypoints.
   - `signInWithEmail` and `signUpWithEmail` have no visible rate limiting, bot protection, or tenant-creation throttling at the application layer.
   - Supabase helps, but a SaaS app that allows public sign-up should still put explicit controls in front of account creation and repeated password attempts.

### Suggestions
1. Keep the current split between fast middleware claim checks and authoritative route-handler/layout checks.
2. When rate limiting is added, implement it in a Vercel-compatible durable layer rather than in-memory process state.

### Refactor Example
```ts
// lib/auth/redirect.ts
export function sanitizeNextPath(input: string | null | undefined) {
  if (!input) return "/dashboard"
  if (!input.startsWith("/")) return "/dashboard"
  if (input.startsWith("//")) return "/dashboard"
  return input
}
```

```ts
// app/login/page.tsx
import { sanitizeNextPath } from "@/lib/auth/redirect"

const next = sanitizeNextPath(resolvedSearchParams?.next)

if (user) redirect(next)

return <LoginForm nextUrl={next} />
```

```ts
// components/login-form.tsx
window.location.assign(nextUrl || "/dashboard")
```

### Status
- Done: shared redirect sanitization helper added and applied across login/OAuth flows.
- Done: layout and `/api/auth/me` now use authoritative auth reads for role/tenant-sensitive bootstrap state.
- Done: login and signup page session checks now require an authoritative user.
- Done: sign-up provisioning failure now attempts compensating cleanup and signs out the partial session.
- Done: invite accept flow validates OTP type explicitly.
- Deferred: production-grade rate limiting / bot protection.

## Deferred Security / Abuse-Control Track

### Rate Limiting / Bot Protection
- `app/actions/auth.ts`
  - `signInWithEmail`: add durable login throttling and abuse detection.
  - `signUpWithEmail`: add sign-up throttling, tenant-creation throttling, and bot protection.
- `app/api/xero/export-invoices/route.ts`
  - Add outbound concurrency limiting / pacing to avoid Xero API rate-limit exhaustion.
- Add a shared review checkpoint later for any other public or high-cost mutation endpoints as additional sections are reviewed.

## 2. Roles / Permissions / RLS (Supabase)

### Summary
- Overall state: needs work
- The baseline is materially better than a typical Supabase app: the repo contains explicit RLS policy DDL for many tenant-bound tables, the auth token hook injects `tenant_id` and `app_role` claims from DB-backed helper functions, and recent audit artifacts show live RLS coverage was checked.
- The remaining problems are not “RLS missing everywhere”; they are narrower and more dangerous: overly broad RLS on Xero export logs and app-layer permission checks that do not consistently match the DB’s actual enforcement.

### Critical Issues
1. None currently blocking in this section after the applied `roles` RLS fix.

### Improvements
1. Tighten `xero_export_logs` RLS.
   - `supabase/migrations/20260310120000_xero_integration.sql` still grants `SELECT` and `INSERT` on `xero_export_logs` to any tenant member via `user_belongs_to_tenant(tenant_id)`.
   - The app route `app/api/xero/export-logs/route.ts` correctly restricts access to admins, but RLS is the true boundary in Supabase. Any tenant member with the publishable key can query those logs directly unless the policy is tightened.
2. Align app-layer permissions with DB permissions for Xero state reads.
   - `supabase/migrations/20260311113000_xero_security_hardening.sql` restricts `xero_connections` access to tenant admins via `is_tenant_admin(tenant_id)`.
   - `app/api/xero/status/route.ts` currently allows any staff role, including instructors, then queries `xero_connections`. Instructors will be blocked by RLS underneath.
   - This is not a data leak, but it is a permission-model inconsistency that will cause confusing 500s / degraded UX and makes the system harder to reason about.
3. Reduce repo-to-live-schema assurance gap.
   - `docs/rls-policy-coverage-2026-03-26.md` explicitly notes that the repo has a small migration subset compared with live (`34` files in repo vs `469` applied live migrations at audit time).
   - That means policy review from git alone is still incomplete even though the baseline audit improved coverage.

### Suggestions
1. Treat shared catalog tables such as `roles` as immutable to tenant users.
   - Prefer no tenant write policy at all, or service-role-only writes via migrations/admin tooling.
2. For sensitive operational tables like `xero_export_logs`, make RLS at least as strict as the API route.
   - If admins only should read logs in the app, admins only should read them in SQL.
3. Add a recurring policy diff check between expected repo DDL and live `pg_policies`.
4. Keep documenting policy intent table-by-table in this file as later sections reveal more sensitive tables.

### Refactor Example
```sql
drop policy if exists roles_manage on public.roles;

-- Shared role catalog should not be tenant-editable.
-- Manage through migrations or service-role-only admin tooling.
```

```sql
drop policy if exists xero_export_logs_tenant_select on public.xero_export_logs;
create policy xero_export_logs_admin_select
on public.xero_export_logs
for select
using (public.is_tenant_admin(tenant_id));
```

### Follow-Up Notes
- Revisit before production hardening pass:
  - tighten `xero_export_logs` RLS to match app-layer intent
  - align Xero route role checks with DB policy expectations
  - reduce repo-vs-live migration drift for policy review confidence

### Status
- Done: replaced global `roles_manage` write policy with a read-only active-roles policy in `supabase/migrations/20260326062651_roles_global_catalog_write_lockdown.sql`.

## 3. API Routes / Server Actions

### Summary
- Overall state: needs work
- The API layer has a lot of good habits already: most handlers validate JSON with Zod, many routes use explicit tenant scoping, and several sensitive paths already use authoritative session reads.
- The main problems are structural rather than cosmetic: some mutation routes still use claim-only sessions, some service-role-backed handlers broaden permissions beyond the DB policy model, and the current rate-limiting utility is not production-grade for Vercel.

### Critical Issues
1. None currently blocking in this section after the applied fixes.

### Improvements
1. Make authoritative session reads the default for all mutation handlers and server actions.
   - Representative examples such as `app/api/observations/route.ts` and `app/api/aircraft/reorder/route.ts` still call `getAuthSession(supabase)` without `requireUser` or authoritative role/tenant options before performing writes.
   - This leaves write paths more dependent on JWT claim freshness than they should be.
2. Replace the in-memory rate limiter with a durable Vercel-compatible backend.
   - `lib/security/rate-limit.ts` stores counters in a process-local `Map`.
   - That means the limits used by routes like `app/api/email/send-invoice/route.ts`, `app/api/email/send-statement/route.ts`, and `app/api/bookings/[id]/send-confirmation-email/route.ts` do not hold across instances, cold starts, or deployments.
   - Do not treat the current helper as a production abuse-control boundary.
3. Remove environment-fragile hard-coded role IDs from route handlers.
   - `app/api/bookings/trial/route.ts` previously hard-coded `STUDENT_ROLE_ID` in the route itself and then used the admin client to create tenant membership rows.
   - That is brittle across environments and any future role reseeding or data repair.

### Suggestions
1. Introduce a small route helper for mutations that always does:
   - authoritative user validation
   - authoritative role/tenant resolution
   - a consistent unauthorized / forbidden / account-not-configured response shape
2. Treat any route that uses `createSupabaseAdminClient()` as privileged infrastructure code.
   - Those handlers should have stricter role checks than ordinary tenant-scoped routes and should be reviewed separately during security passes.
3. Move high-cost side effects toward queueable or resumable jobs where possible.
   - Email rendering/sending and third-party export flows are the clearest candidates.
4. Continue tracking rate limiting centrally here rather than assuming the current helper is sufficient.

### Refactor Example
```ts
const { user, role, tenantId } = await getRequiredApiSession(supabase, {
  includeRole: true,
})

if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })
if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
```

### Follow-Up Notes
- Revisit before production hardening pass:
  - audit remaining service-role-backed routes so their app-layer permissions never exceed DB policy intent
  - convert the current in-memory rate limiter to durable storage
  - standardize authoritative session checks across all remaining mutation handlers and server actions

### Status
- Done: `app/api/xero/accounts/upsert/route.ts` now requires admin-level access instead of generic staff access before using the admin client.
- Done: `app/api/bookings/trial/route.ts` now resolves the `student` role from the database instead of relying on a hard-coded UUID.
- Done: representative mutation handlers `app/api/observations/route.ts` and `app/api/aircraft/reorder/route.ts` now use authoritative API session resolution.
- Done: tightened remaining authenticated mutation outliers on aircraft/maintenance/observation surfaces by requiring explicit staff access in `app/api/aircraft/route.ts` (`POST`), `app/api/aircraft/reorder/route.ts` (`PATCH`), `app/api/aircraft-components/route.ts` (`POST`/`PATCH`), `app/api/aircraft-charge-rates/route.ts` (`POST`/`PATCH`/`DELETE`), `app/api/maintenance-visits/route.ts` (`POST`/`PATCH`), and `app/api/observations/route.ts` (`POST`/`PATCH`).
- Done: removed direct `createSupabaseAdminClient()` usage from `app/api/*` service-role-assisted handlers by switching remaining routes (`app/api/xero/disconnect/route.ts`, `app/api/xero/retry-export/route.ts`, `app/api/xero/callback/route.ts`, and member access invite-management routes) to purpose-labeled privileged client creation via `createPrivilegedSupabaseClient(...)`.
- Deferred: durable, cross-instance rate limiting for Vercel.
- Deferred: broader mutation-route sweep to standardize authoritative session usage across the rest of the API surface.

## 4. Database Design & Queries

### Summary
- Deferred pending live database review.
- Repo-only review is not enough here for a production-readiness verdict because this section depends on actual schema state, indexes, constraints, query plans, drift, and live policy/function definitions.

### Follow-Up Notes
- Revisit later with live database access or MCP-backed inspection.
- Validate:
  - actual table and index definitions in the active environment
  - query plans for expensive list/detail/reporting paths
  - migration drift between repo and live project
  - RPC/function definitions and permissions in the live database

## 5. Frontend Components (React / Next.js)

### Summary
- Overall state: needs work
- The frontend is functional and there is a clear pattern of server-rendered pages wrapping client-heavy feature components, which is a sane baseline for a SaaS app.
- The main frontend issues are around overuse of client-only rendering in settings/config areas, hard browser refresh escapes, and repeated client-side fetch patterns that leave performance and resilience on the table.

### Critical Issues
1. None currently blocking in this section.

### Improvements
1. Reduce unnecessary `ssr: false` usage for large settings tabs.
   - `components/settings/settings-page-client.tsx` dynamically imports most tabs with `ssr: false`.
   - That pushes a large admin/settings surface fully client-side, delays usable content, and gives up Next.js server rendering benefits even though the page already has server-fetched initial data.
2. Remove full page reload escapes from client components.
   - `components/aircraft/component-edit-modal.tsx` calls `window.location.reload()` after successful mutations.
   - That is a blunt recovery path that discards React state, breaks smooth UX, and usually indicates missing local state refresh or router invalidation.
3. Consolidate repeated client-side settings fetches.
   - Components like `components/settings/charges/landing-fees-config.tsx` perform multiple direct `fetch("/api/...")` calls on mount for related config data.
   - This adds extra waterfalls and duplicate loading logic in areas where server-provided data or a more centralized query layer would be cleaner.
4. Use React Query more consistently where it already exists.
   - `components/settings/training/lessons-tab.tsx` uses React Query well for list state and optimistic updates, but much of the broader settings surface still uses bespoke `useEffect` + `fetch` patterns.
   - You already ship a global provider in `components/providers/react-query-provider.tsx`; the inconsistency is now mostly architectural debt rather than missing infrastructure.

### Suggestions
1. Prefer server-rendered initial payloads for settings/admin pages, then hydrate client interactions on top.
2. Replace `window.location.reload()` with targeted invalidation:
   - local state updates
   - React Query invalidation
   - `router.refresh()` where server data truly needs to be re-fetched
3. Standardize async client data patterns.
   - Either lean further into React Query for client-managed lists/config editors, or move more of those payloads into server page loaders and pass them down as props.
4. Keep client boundaries intentional.
   - A component should be client-only because it needs browser APIs or rich interaction, not just because it is convenient.

### Refactor Example
```ts
// Avoid:
window.location.reload()

// Prefer:
router.refresh()
// or invalidate the specific React Query key / update local state
```

### Follow-Up Notes
- Revisit later:
  - keep settings/admin tab SSR boundaries under review and prevent reintroducing `ssr: false` wrappers where server bootstrap is available
  - replace remaining hard reloads with targeted refresh/invalidation
  - reduce duplicated client-side config fetches across settings screens

### Status
- Done: replaced hard page reloads in `components/aircraft/component-edit-modal.tsx` with targeted `router.refresh()` behavior.
- Done: replaced hard page reload in `components/aircraft/aircraft-settings-tab.tsx` with `router.refresh()`.
- Done: removed `ssr: false` dynamic wrappers from the main settings/admin tab surface (`components/settings/settings-page-client.tsx`) and retained server-bootstrapped initial payload flow in `app/settings/page.tsx`.
- Deferred: broader consolidation of repeated client-side config fetches.

## 6. State Management & Data Fetching

### Summary
- Overall state: needs work
- The app has usable primitives in place: React Query is installed globally, auth and timezone both have dedicated contexts, and many mutation flows already call `router.refresh()` after success.
- The main issue is inconsistency. Different parts of the app use local state, raw `fetch`, React Query, context, and router refreshes in overlapping ways, which increases stale-data risk and makes the behavior harder to reason about.

### Critical Issues
1. None currently blocking in this section.

### Improvements
1. Standardize client data fetching instead of mixing raw `fetch` and React Query ad hoc.
   - `components/settings/training/lessons-tab.tsx` is a stronger example that uses React Query for fetch, optimistic reorder, and invalidation.
   - Many other components still issue one-off `fetch("/api/...")` calls inside effects or event handlers and then rely on `router.refresh()` for consistency.
   - This split makes cache behavior and stale-state debugging much harder than necessary.
2. Auth state is managed outside the query/cache layer and can drift from the rest of the app.
   - `contexts/auth-context.tsx` uses its own fetch + local state + `BroadcastChannel` sync path for `/api/auth/me`.
   - That works, but it creates a separate state system alongside React Query and server-rendered props, which increases the number of sources of truth for user/session data.
3. There is repeated “fetch related config on mount” logic across settings screens.
   - Representative example: `components/settings/charges/landing-fees-config.tsx` loads landing fees, aircraft types, and default tax rate separately in a client callback.
   - This creates duplicate loading/error code and unnecessary request fan-out across similar admin screens.
4. `router.refresh()` is doing a lot of cache invalidation work that should sometimes stay local.
   - Components such as `components/equipment/equipment-page-client.tsx` use `router.refresh()` after modal mutations, which is safe but broad.
   - Overusing it can hide missing local/query invalidation discipline and trigger heavier refreshes than needed.

### Suggestions
1. Choose a clearer rule of thumb:
   - server components/pages provide initial payloads
   - React Query owns client-managed list/detail caches and invalidation
   - contexts are reserved for truly cross-cutting ambient state such as auth/session bootstrap and timezone
2. Where React Query is already present, prefer extending it rather than adding more bespoke `useEffect` + `fetch` logic.
3. Keep `router.refresh()` for cases where server-rendered data truly needs revalidation, but prefer query invalidation or local state reconciliation for contained client-side updates.
4. Consider eventually moving auth bootstrap onto a query-backed abstraction if auth-driven client state grows further.

### Refactor Example
```ts
const { data, isLoading } = useQuery({
  queryKey: ["landing-fees"],
  queryFn: fetchLandingFees,
})

const mutation = useMutation({
  mutationFn: saveLandingFee,
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ["landing-fees"] })
  },
})
```

### Follow-Up Notes
- Revisit later:
  - standardize how admin/config screens fetch and invalidate data
  - reduce reliance on broad `router.refresh()` after contained mutations
  - continue evaluating whether additional auth/session consumers should migrate to query-backed reads

### Status
- Done: `components/bookings/member-training-peek.tsx` now uses React Query instead of bespoke `useEffect` + `fetch` + abort-controller state management.
- Done: `contexts/auth-context.tsx` now uses shared React Query state for `/api/auth/me` (including refresh and cross-tab sync) instead of bespoke fetch/local-state ownership.
- Done: `components/equipment/equipment-page-client.tsx` now uses a shared `useEquipmentQuery` hook plus query invalidation after equipment mutations instead of broad page refresh.
- Done: `components/equipment/equipment-detail-client.tsx` now uses a shared detail query (`hooks/use-equipment-detail-query.ts`) and targeted invalidation for equipment/issuance/update refreshes instead of `router.refresh()` after contained mutations.
- Done: added shared members/invoices list query hooks (`hooks/use-members-query.ts`, `hooks/use-invoices-query.ts`) and list GET endpoints (`app/api/members/route.ts`, `app/api/invoices/route.ts`) so `components/members/members-page-client.tsx` and `components/invoices/invoices-page-client.tsx` now refresh through query invalidation instead of broad route refreshes.
- Done: added shared invoice member-options query usage (`hooks/use-invoice-member-options-query.ts`) and removed list-level `router.refresh()` after Xero bulk export / member credit actions in `components/invoices/invoices-table.tsx` by invalidating the shared invoices query key.
- Done: moved invoice detail surface to query-backed refresh behavior with `hooks/use-invoice-detail-query.ts`, extended `app/api/invoices/[id]/route.ts` to return Xero status, and replaced invoice-detail/payment/export/void refreshes with targeted query invalidation in `components/invoices/invoice-detail-client.tsx`, `components/invoices/invoice-view-actions.tsx`, and `components/invoices/record-payment-modal.tsx`.
- Done: moved member membership summary refreshes to query-backed behavior with `hooks/use-member-memberships-query.ts` and `app/api/members/[id]/memberships/summary/route.ts`, then replaced membership create/renew `router.refresh()` calls with targeted invalidation in `components/members/member-memberships.tsx`, `components/members/create-membership-modal.tsx`, and `components/members/renew-membership-modal.tsx`.
- Done: finalized members/invoices query-key consistency by adding `hooks/use-member-access-query.ts` and moving `components/members/member-account-access-tab.tsx` off inline member-access query keys.
- Done: removed duplicate server-side Xero status fetch in `app/invoices/[id]/page.tsx`; invoice detail now relies on the shared query-backed detail path for Xero status refreshes.
- Done: added shared booking detail query ownership via `hooks/use-booking-query.ts`, then moved `components/bookings/booking-detail-client.tsx`, `components/bookings/booking-checkout-client.tsx`, and `components/bookings/booking-checkin-client.tsx` off contained `router.refresh()` calls to targeted booking/invoice query invalidation after mutations.
- Done: introduced query-backed scheduler reads (`app/api/scheduler/route.ts`, `hooks/use-scheduler-page-query.ts`) and replaced scheduler mutation refreshes in `components/scheduler/resource-timeline-scheduler.tsx` with targeted invalidation of the active scheduler-date query key.
- Done: removed contained settings-page broad refreshes in `components/settings/general-tab.tsx`, `components/settings/bookings-tab.tsx`, and `components/settings/invoicing-tab.tsx`; those tabs now reconcile state from returned PATCH payloads without route-level refresh.
- Done: moved integrations refresh behavior to query-backed invalidation with `hooks/use-xero-status-query.ts` and `hooks/use-xero-settings-query.ts`, and updated `components/settings/integrations-tab.tsx` to invalidate Xero-specific query keys instead of calling `router.refresh()`.
- Done: removed contained aircraft/dashboard route refreshes in `components/aircraft/add-aircraft-modal.tsx`, `components/aircraft/component-edit-modal.tsx`, `components/aircraft/aircraft-table.tsx`, and `components/dashboard/booking-requests-card.tsx` by switching to navigation-only/local state/query invalidation updates.
- Done: removed the final `components/*` `router.refresh()` callsites by (1) using redirect-only auth navigation in `components/login-form.tsx`, (2) reconciling returned PATCH payloads through local aircraft state in `components/aircraft/aircraft-settings-tab.tsx` and `components/aircraft/aircraft-detail-client.tsx`, and (3) moving equipment detail refreshes to targeted query invalidation with new history GET endpoints in `app/api/equipment-issuance/route.ts` and `app/api/equipment-updates/route.ts`.
- Done: moved `components/aircraft/aircraft-charge-rates-table.tsx` onto shared query ownership (`hooks/use-aircraft-charge-rates-query.ts`, `hooks/use-flight-types-query.ts`, `hooks/use-default-tax-rate-query.ts`) and shifted several training settings mutation fetches out of component ownership by adding API helpers to `hooks/use-exams-query.ts`, `hooks/use-endorsements-query.ts`, `hooks/use-experience-types-query.ts`, and `hooks/use-syllabi-query.ts`.
- Done: normalized remaining high-volume charge settings mutations by moving inline API writes out of `components/settings/charges/chargeable-types-config.tsx`, `components/settings/charges/chargeables-config.tsx`, `components/settings/charges/flight-types-config.tsx`, and `components/settings/charges/landing-fees-config.tsx` into shared helpers on `hooks/use-chargeable-types-query.ts`, `hooks/use-chargeables-admin-query.ts`, `hooks/use-flight-types-query.ts`, and `hooks/use-landing-fees-query.ts`.
- Done: finished the next settings batch for lessons and memberships by moving inline mutations out of `components/settings/training/lessons-tab.tsx`, `components/settings/training/lessons/lesson-modal.tsx`, `components/settings/memberships/membership-types-config.tsx`, and `components/settings/memberships/membership-year-config.tsx` into shared helpers (`hooks/use-lessons-query.ts`, `hooks/use-membership-types-query.ts`, and new `hooks/use-memberships-settings-query.ts`).
- Done: cleared the remaining settings block by extracting all inline settings/xero/tax/cancellation trigger mutations and dropdown reads into shared hook APIs (`hooks/use-tax-rates-query.ts`, `hooks/use-cancellation-categories-query.ts`, `hooks/use-bookings-settings-query.ts`, `hooks/use-invoicing-settings-query.ts`, `hooks/use-general-settings-query.ts`, `hooks/use-email-trigger-settings-query.ts`, `hooks/use-xero-accounts-query.ts`, `hooks/use-xero-tax-rates-query.ts`, `hooks/use-xero-status-query.ts`, `hooks/use-xero-settings-query.ts`) and wiring `components/settings/*` to those helpers.
- Done: normalized a remaining settings invalidation inconsistency in `components/settings/charges/chargeables-config.tsx` by replacing ad-hoc query key literals with shared hook-owned key exports from `hooks/use-chargeables-admin-query.ts`.
- Done: cleared the remaining aircraft and equipment raw-fetch block by moving aircraft CRUD/reorder/type/component/maintenance/observation API ownership into shared hooks (`hooks/use-aircraft-query.ts`, `hooks/use-aircraft-types-query.ts`, `hooks/use-aircraft-components-query.ts`, `hooks/use-aircraft-maintenance-visits-query.ts`, `hooks/use-aircraft-observations-query.ts`) and equipment CRUD/history mutations into shared helpers on `hooks/use-equipment-query.ts` and `hooks/use-equipment-detail-query.ts`; `components/aircraft/*` and `components/equipment/*` now invalidate targeted query keys or reconcile returned payloads locally instead of issuing inline `/api` requests.
- Done: cleared the next members + training batch by moving remaining inline member/training/account-statement API ownership into shared helpers (`hooks/use-members-query.ts`, `hooks/use-member-access-query.ts`, `hooks/use-member-contact-details-query.ts`, `hooks/use-member-flight-history-query.ts`, `hooks/use-account-statement-query.ts`, `hooks/use-member-training-query.ts`, `hooks/use-instructors-query.ts`) and wiring `components/members/*` + `components/training/*` to those helpers for reads/mutations.
- Done: completed the final bookings + invoices + scheduler raw-fetch batch by moving the remaining inline component API calls into shared booking/invoice hook helpers (`hooks/use-booking-query.ts`, `hooks/use-invoice-detail-query.ts`, `hooks/use-cancellation-categories-query.ts`) and rewiring `components/bookings/booking-detail-client.tsx`, `components/bookings/booking-checkout-client.tsx`, `components/bookings/cancel-booking-modal.tsx`, `components/invoices/invoice-view-actions.tsx`, `components/invoices/void-and-reissue-modal.tsx`, `components/invoices/xero-bulk-export-button.tsx`, and `components/scheduler/new-booking-modal.tsx` to those helpers with existing targeted invalidation flows.
- Snapshot (after this pass): `router.refresh()` usage in `components/*` is now zero.
- Snapshot (after this pass): raw `fetch("/api/...")` callsites in `components/*` are reduced again by this batch, including complete removal from the remaining aircraft/equipment client surfaces (`components/aircraft/aircraft-settings-tab.tsx`, `components/aircraft/aircraft-maintenance-items-tab.tsx`, `components/aircraft/log-maintenance-modal.tsx`, `components/aircraft/edit-maintenance-history-modal.tsx`, `components/aircraft/component-edit-modal.tsx`, `components/aircraft/add-aircraft-modal.tsx`, `components/aircraft/reorder-aircraft-modal.tsx`, `components/aircraft/aircraft-observations-table.tsx`, `components/aircraft/add-observation-modal.tsx`, `components/aircraft/view-observation-modal.tsx`, `components/aircraft/resolve-observation-modal.tsx`, `components/equipment/add-equipment-modal.tsx`, `components/equipment/update-equipment-modal.tsx`, `components/equipment/issue-equipment-modal.tsx`, `components/equipment/return-equipment-modal.tsx`).
- Snapshot (after this pass): raw `fetch("/api/...")` callsites in `components/*` currently appear in 0 files (down from 7 before this final bookings/invoices/scheduler normalization pass).
- Snapshot (after this pass): raw `fetch("/api/...")` callsites in `components/settings/*` are now zero.
- Remaining (high-value next pass): focus on non-`components/*` client fetch normalization surfaces (for example `contexts/*` and larger hook-level orchestration areas) where raw API ownership can still be tightened behind shared query/mutation contracts.
- Deferred: broader standardization of settings/admin data loading and mutation invalidation patterns.

## 7. Environment Variables & Secrets

### Summary
- Overall state: needs work
- The baseline is not reckless: env files are gitignored, Supabase public and admin keys are separated logically, and server-only integrations like Resend and Xero read their credentials at runtime rather than hard-coding them.
- The main issues are deployment hygiene and secret-boundary clarity. The repo did not include a checked example env file, several server paths built external URLs directly from `NEXT_PUBLIC_APP_URL` with brittle fallbacks, and there are still modules where public and privileged env concerns sit close together.

### Critical Issues
1. None currently blocking in this section after the applied fixes.

### Improvements
1. Keep canonical app URL handling centralized.
   - Invite flows and email links previously assembled URLs directly from `NEXT_PUBLIC_APP_URL` and in some cases passed an empty string when it was unset.
   - That made preview/prod behavior more fragile than necessary and could produce broken invite redirects or incorrect email links.
2. Make deployment configuration discoverable.
   - The repo did not have a committed `.env.example`, which raises the chance of incomplete Vercel setup or ad hoc secret naming drift.
3. Keep public and privileged env boundaries obvious in code.
   - Previously, `lib/supabase/env.ts` exposed both public and admin helpers while also being imported by browser-adjacent code.
   - Splitting this boundary reduces accidental privileged-env coupling over time.
4. Revisit whether `NEXT_PUBLIC_APP_URL` should remain the only explicit app URL configuration.
   - The new helper now falls back to Vercel runtime URLs when needed, which is safer operationally.
   - For production, keeping a single explicit canonical URL is still cleaner for invite links, email links, and SEO-sensitive surfaces.

### Suggestions
1. Keep secrets in Vercel project env vars only and avoid putting production values anywhere outside `.env.local` / Vercel secret storage.
2. Prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` over the legacy anon/service-role names going forward.
3. Keep Supabase env helpers split by boundary:
   - `lib/supabase/env-public.ts` for browser/shared publishable config
   - `lib/supabase/env-admin.ts` for server-only privileged config
4. Add env verification to deployment checklists:
   - Supabase URL + publishable key
   - Supabase secret key
   - canonical app URL
   - Xero credentials and redirect URI
   - Resend API key and sender address

### Refactor Example
```ts
const appUrl = getRequiredPublicAppUrl()

await admin.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${appUrl}/auth/invite/accept`,
})
```

### Follow-Up Notes
- Revisit later:
  - confirm production Vercel env vars are set consistently across preview and production environments
  - keep env/secrets verification in the final deployment checklist as deployment ownership evolves

### Status
- Done: added `.env.example` so expected env keys are explicit in the repo.
- Done: centralized external app URL resolution in `lib/env/public-app-url.ts`.
- Done: invite redirects and email links now use the shared app URL helper instead of ad hoc `NEXT_PUBLIC_APP_URL` string assembly.
- Done: split Supabase environment helpers into `lib/supabase/env-public.ts` and `lib/supabase/env-admin.ts`, and migrated call sites to the boundary-specific modules.
- Done: added `docs/deployment-env-checklist.md` with canonical URL, Supabase, Xero, and Resend parity checks for staging/production rollout.

## 10. General Code Quality & Architecture

### Summary
- Overall state: needs work
- The application is still structurally understandable. The folder layout is sensible, domain areas are recognizable, and there is a real attempt to keep reusable logic under `lib/` instead of burying everything in route handlers.
- The main problem is scale pressure. The app has grown into a large monolith with repeated patterns for auth checks, route wiring, client fetch state, and settings CRUD. That is not an immediate rewrite problem, but it is now a production-readiness concern because review cost, bug surface, and permission drift all increase as the same logic keeps getting reimplemented.

### Critical Issues
1. None currently blocking in this section on their own.

### Improvements
1. Several core files are now too large and carry too many responsibilities.
   - [components/scheduler/new-booking-modal.tsx](/Users/callumsoutar/Developing/FlightDesk/flight-desk/components/scheduler/new-booking-modal.tsx) is still roughly 1,595 lines even after the section 10 modal extractions.
   - [components/settings/charges/landing-fees-config.tsx](/Users/callumsoutar/Developing/FlightDesk/flight-desk/components/settings/charges/landing-fees-config.tsx) is roughly 1,016 lines.
   - [components/settings/memberships/membership-types-config.tsx](/Users/callumsoutar/Developing/FlightDesk/flight-desk/components/settings/memberships/membership-types-config.tsx) is roughly 851 lines.
   - These files are beyond normal feature-component size and now combine orchestration, form logic, API calling, state coordination, and view rendering in one place. That slows safe change velocity.
2. Route-handler architecture is repetitive and inconsistent.
   - Multiple CRUD-style routes such as [app/api/chargeables/route.ts](/Users/callumsoutar/Developing/FlightDesk/flight-desk/app/api/chargeables/route.ts), [app/api/flight-types/route.ts](/Users/callumsoutar/Developing/FlightDesk/flight-desk/app/api/flight-types/route.ts), [app/api/lessons/route.ts](/Users/callumsoutar/Developing/FlightDesk/flight-desk/app/api/lessons/route.ts), and [app/api/experience-types/route.ts](/Users/callumsoutar/Developing/FlightDesk/flight-desk/app/api/experience-types/route.ts) each repeat their own auth resolution, role gating, parsing, response shaping, and query wiring.
   - This repetition is exactly how permission inconsistencies and edge-case drift accumulate.
3. Settings architecture still has some split ownership deeper in the tab surfaces, even though the top-level contract is now clearer.
   - [app/settings/page.tsx](/Users/callumsoutar/Developing/FlightDesk/flight-desk/app/settings/page.tsx) now owns initial tab selection and the server-bootstrap handoff, and [components/settings/settings-page-client.tsx](/Users/callumsoutar/Developing/FlightDesk/flight-desk/components/settings/settings-page-client.tsx) no longer hides the main tabs behind `dynamic(..., { ssr: false })`.
   - Server-bootstrapped forms such as [components/settings/bookings-tab.tsx](/Users/callumsoutar/Developing/FlightDesk/flight-desk/components/settings/bookings-tab.tsx) and [components/settings/memberships/membership-year-config.tsx](/Users/callumsoutar/Developing/FlightDesk/flight-desk/components/settings/memberships/membership-year-config.tsx) no longer fall back to mount-time refetches.
   - The remaining debt is in the larger client-owned collection editors, where raw fetches, React Query hooks, and tab-local orchestration still coexist.
4. Privileged infrastructure code is leaking into otherwise ordinary data helpers.
   - [lib/settings/fetch-general-settings.ts](/Users/callumsoutar/Developing/FlightDesk/flight-desk/lib/settings/fetch-general-settings.ts) and [lib/invoices/fetch-invoicing-settings.ts](/Users/callumsoutar/Developing/FlightDesk/flight-desk/lib/invoices/fetch-invoicing-settings.ts) call `createSupabaseAdminClient()` internally for storage signed URLs.
   - The code is not wrong, but it makes the privilege boundary harder to see because service-role behavior is embedded inside helpers that otherwise look like plain read-model loaders.
5. Client state patterns are still split across multiple abstractions.
   - [components/providers/react-query-provider.tsx](/Users/callumsoutar/Developing/FlightDesk/flight-desk/components/providers/react-query-provider.tsx) exists and is correctly global.
   - But [contexts/auth-context.tsx](/Users/callumsoutar/Developing/FlightDesk/flight-desk/contexts/auth-context.tsx) still runs its own fetch and broadcast sync flow, while many feature components continue to use raw `fetch` in effects.
   - That makes it harder to reason about ownership of cached state and mutation invalidation across the app.

### Suggestions
1. Introduce “feature service” modules for the repetitive CRUD domains.
   - Keep route handlers thin and move shared validation, permission checks, and DB write/read orchestration into domain-level server modules.
2. Split oversized feature components by responsibility, not by arbitrary line count.
   - Example split for the booking modal:
     - data loaders / option queries
     - booking form state and derived calculations
     - trial / recurring / standard submission flows
     - presentational field sections
3. Make privileged operations visually obvious.
   - Prefer dedicated `*-admin.ts` or `*-privileged.ts` server modules when service-role access is required, instead of hiding it inside generic fetch helpers.
4. Pick a firmer rule for settings/admin surfaces:
   - server bootstrapped data where possible
   - React Query for client-owned editing lists/config tables
   - avoid parallel ad hoc fetch layers inside each tab
5. Continue standardizing auth entrypoints.
   - `getRequiredApiSession()` is the right direction. The codebase should converge toward a small number of blessed auth/permission patterns instead of many local variations.

### Refactor Example
```ts
// app/api/flight-types/route.ts
export async function POST(request: Request) {
  return withTenantAdminMutation(request, async ({ supabase, tenantId, body }) => {
    const input = createFlightTypeSchema.parse(body)
    return createFlightType(supabase, tenantId, input)
  })
}
```

### Follow-Up Notes
- Revisit later:
  - break up the largest client components, starting with booking/scheduler and settings config surfaces
  - make all service-role-assisted logic easier to identify during security review
  - continue reducing any leftover one-off query keys or bespoke client fetch paths outside the now-standardized settings editors

### Status
- Done: added a shared tenant-admin route helper in `lib/api/tenant-route.ts` to centralize authoritative session resolution and no-store JSON responses for admin mutation routes.
- Done: applied that helper to representative CRUD routes in `app/api/flight-types/route.ts` and `app/api/experience-types/route.ts` to reduce repeated auth/tenant/response boilerplate.
- Done: extended the same route-helper pattern to `app/api/chargeables/route.ts`, `app/api/chargeable_types/route.ts`, and `app/api/lessons/route.ts`, so more of the settings/admin CRUD surface now shares the same authoritative admin gate and no-store JSON response path.
- Done: continued the rollout across `app/api/syllabus/route.ts`, `app/api/endorsements/route.ts`, `app/api/tax-rates/route.ts`, and the create path in `app/api/aircraft-types/route.ts`, further reducing hand-rolled admin mutation wiring across settings-maintained resources.
- Done: expanded the same consistency pass into `app/api/cancellation-categories/route.ts`, `app/api/landing-fees/route.ts`, `app/api/landing-fee-rates/route.ts`, `app/api/membership-types/route.ts`, and `app/api/membership-types/[id]/route.ts`, covering more of the settings CRUD surface with the shared admin-mutation pattern.
- Done: aligned `app/api/settings/bookings/route.ts`, `app/api/settings/general/route.ts`, `app/api/settings/invoicing/route.ts`, and `app/api/settings/email-triggers/route.ts` with the same shared tenant-admin mutation entrypoint and `noStoreJson()` response behavior.
- Done: extended the same consistency rules to `app/api/settings/xero/route.ts`, `app/api/settings/memberships/route.ts`, `app/api/settings/logo/route.ts`, and `app/api/xero/accounts/upsert/route.ts`, so more privileged settings/Xero handlers now share the same admin gate and no-store response shape.
- Done: brought the member access invite-management routes (`app/api/members/[id]/access/route.ts`, `app/api/members/[id]/access/invite/route.ts`, `app/api/members/[id]/access/resend-invite/route.ts`, `app/api/members/[id]/access/cancel-invite/route.ts`) and `app/api/xero/disconnect/route.ts` into the same consistency pass, reducing more hand-rolled privileged route wiring.
- Done: continued the privileged Xero cleanup in `app/api/xero/retry-export/route.ts`, `app/api/xero/sync-accounts/route.ts`, `app/api/xero/void-invoice/route.ts`, and `app/api/xero/connect/route.ts`, keeping response handling and admin/staff gating more consistent across the integration surface.
- Done: normalized more Xero read/admin endpoints in `app/api/xero/accounts/route.ts`, `app/api/xero/chart-of-accounts/route.ts`, `app/api/xero/export-logs/route.ts`, and `app/api/xero/status/route.ts`; the status route now matches the admin-only access model expected by the underlying Xero connection policy.
- Done: added a shared tenant-staff route helper alongside the admin helper in `lib/api/tenant-route.ts`, and applied it to `app/api/email/send-invoice/route.ts`, `app/api/email/send-statement/route.ts`, `app/api/email/logs/route.ts`, and `app/api/bookings/[id]/send-confirmation-email/route.ts` so staff-scoped manual email paths no longer hand-roll the same tenant/session checks.
- Done: extended the staff-route cleanup across `app/api/xero/tax-rates/route.ts`, `app/api/xero/export-status/[invoiceId]/route.ts`, and `app/api/xero/export-invoices/route.ts`, so more of the Xero JSON surface now uses the shared tenant-staff/no-store response pattern.
- Done: applied the same staff-route pattern to additional shared read endpoints in `app/api/bookings/options/route.ts`, `app/api/account-statement/route.ts`, `app/api/invoices/member-options/route.ts`, and `app/api/instructors/route.ts`, reducing more repeated tenant/session response wiring on commonly-used data loaders.
- Done: rolled the shared staff/admin route helpers through the equipment APIs in `app/api/equipment/route.ts`, `app/api/equipment/[id]/route.ts`, `app/api/equipment-issuance/route.ts`, and `app/api/equipment-updates/route.ts`, removing another cluster of duplicated auth/tenant/no-store response logic.
- Done: normalized shared no-store response handling across mixed-permission booking routes in `app/api/bookings/route.ts`, `app/api/bookings/availability/route.ts`, and `app/api/bookings/recurring/route.ts`, reducing more inconsistent route-level response wiring even where a stricter shared role helper was not yet appropriate.
- Done: applied the same response-consistency cleanup to mixed-access member/training reads in `app/api/members/[id]/training/route.ts`, `app/api/members/[id]/training/overview/route.ts`, `app/api/members/[id]/training/peek/route.ts`, and `app/api/members/[id]/flight-history/route.ts`, keeping existing permission logic while reducing more hand-rolled no-store response boilerplate.
- Done: continued the member-training cleanup in `app/api/members/[id]/training/comments/route.ts`, `app/api/members/[id]/training/debriefs/route.ts`, `app/api/members/[id]/training/enrollments/route.ts`, and `app/api/members/[id]/training/enrollments/[enrollmentId]/route.ts`, using the shared no-store/admin/staff response patterns while preserving the existing access rules.
- Done: completed the remaining member-training route consistency pass in `app/api/members/[id]/training/exam-results/route.ts`, `app/api/members/[id]/training/flying/route.ts`, and `app/api/members/[id]/training/theory/route.ts`, moving the staff-only exam result mutation onto the shared tenant-staff helper and standardizing the mixed-access read responses onto `noStoreJson()`.
- Done: continued the bookings-by-id cleanup in `app/api/bookings/[id]/route.ts`, `app/api/bookings/[id]/experience/route.ts`, `app/api/bookings/[id]/warnings/route.ts`, and `app/api/bookings/[id]/debrief/route.ts`, using the shared tenant-staff helper for the staff-only routes and standardizing the mixed-permission booking detail responses onto `noStoreJson()` without changing the underlying access model.
- Done: extended the same cleanup to booking check-in routes in `app/api/bookings/[id]/checkin/approve/route.ts` and `app/api/bookings/[id]/checkin/correct/route.ts`, moving the explicitly staff-scoped approval path onto the shared tenant-staff helper and normalizing the correction responses onto `noStoreJson()` while leaving the RPC-backed authorization model intact.
- Done: continued the admin CRUD/settings rollout in `app/api/exams/route.ts` and `app/api/lessons/reorder/route.ts`, moving those routes onto the shared tenant-admin helper and `noStoreJson()` response path instead of repeating local authoritative auth/tenant checks.
- Done: continued the member API cleanup in `app/api/members/route.ts` and `app/api/members/[id]/contact-details/route.ts`, moving staff-only member creation onto the shared tenant-staff helper and standardizing the mixed-access contact-details responses onto `noStoreJson()`.
- Done: cleaned up the legacy charge-rate handlers in `app/api/aircraft-charge-rates/route.ts` and `app/api/instructor-charge-rates/route.ts`, replacing ad hoc tenant resolution with authoritative API-session reads and standardizing their response path onto `noStoreJson()` without changing their existing authenticated access scope.
- Done: continued the same authenticated-route cleanup across `app/api/aircraft/route.ts`, `app/api/aircraft-components/route.ts`, `app/api/maintenance-visits/route.ts`, and `app/api/aircraft/[id]/tech-log/route.ts`, replacing repeated tenant-resolution boilerplate with authoritative API-session reads and standardizing their no-store JSON responses.
- Done: applied the same response/session consistency pass to `app/api/invoice_items/route.ts`, `app/api/invoices/[id]/route.ts`, and `app/api/observations/route.ts`, standardizing mixed staff/member invoice reads and authenticated observation handlers onto authoritative API-session reads plus `noStoreJson()`.
- Done: cleaned up the last small API stragglers in `app/api/auth/me/route.ts`, `app/api/aircraft/reorder/route.ts`, and `app/api/aircraft/[id]/route.ts`, standardizing them onto the shared no-store response path and authoritative API-session reads where tenant resolution was still hand-rolled.
- Done: normalized `app/api/bookings/trial/route.ts` onto the shared tenant-staff helper and `noStoreJson()` response path, keeping its privileged guest-provisioning and admin-client booking flow intact while removing more hand-rolled staff/tenant response boilerplate.
- Done: completed the broader route-helper/session-normalization rollout across the remaining `app/api` surface, including shared authenticated/staff/admin tenant-route helpers for mixed read/write routes; the remaining bespoke session reads in `app/api/auth/me/route.ts` and `app/api/xero/callback/route.ts` are intentional bootstrap/OAuth callback exceptions rather than unfinished standardization work.
- Done: started the deferred frontend/settings cleanup by introducing a shared React Query aircraft-types hook in `hooks/use-aircraft-types-query.ts` and moving `components/aircraft/add-aircraft-modal.tsx` and `components/aircraft/aircraft-settings-tab.tsx` off duplicated local fetch state, reducing repeated client-side settings loading on the aircraft management surface.
- Done: continued the client-side query cleanup with `hooks/use-aircraft-maintenance-visits-query.ts`, moving `components/aircraft/aircraft-maintenance-history-tab.tsx` off bespoke `useEffect` loading state and onto shared query/invalidation behavior for maintenance visit reads and refreshes.
- Done: extended the same aircraft-surface cleanup with `hooks/use-aircraft-components-query.ts`, moving `components/aircraft/aircraft-maintenance-items-tab.tsx` off its local row cache and onto shared query-backed component reads plus query-cache updates/invalidation after create, update, and maintenance-log actions.
- Done: continued the remaining CRUD/read normalization in `app/api/aircraft-types/route.ts`, `app/api/chargeable_types/route.ts`, `app/api/chargeables/route.ts`, `app/api/landing-fees/route.ts`, and `app/api/tax-rates/route.ts`, replacing their remaining hand-rolled tenant resolution with authoritative API-session reads.
- Done: made privileged service-role access more explicit by adding `lib/supabase/privileged.ts` and using purpose-labelled privileged client creation in `app/api/bookings/trial/route.ts`, `app/api/settings/logo/route.ts`, and `app/api/xero/accounts/upsert/route.ts`, so those elevated paths are easier to spot during security review.
- Done: extended the shared aircraft-types query usage into `components/settings/charges/landing-fees-config.tsx`, removing one more repeated client-side settings fetch from a large configuration surface and tightening that settings/data-loading contract.
- Done: continued the shared settings-query rollout with `hooks/use-default-tax-rate-query.ts` and `hooks/use-chargeable-types-query.ts`, moving `components/settings/charges/chargeables-config.tsx` and `components/settings/charges/landing-fees-config.tsx` off duplicated default-tax-rate and chargeable-type fetch helpers.
- Done: extended the same settings-query consolidation into `components/settings/memberships/membership-types-config.tsx` and `components/settings/charges/chargeable-types-config.tsx`, so more of the settings surface now relies on shared query hooks instead of local one-off fetch helpers.
- Done: added `hooks/use-chargeables-query.ts` and moved `components/settings/bookings-tab.tsx` plus `components/settings/memberships/membership-types-config.tsx` off bespoke chargeables fetch logic, further reducing overlap between raw client fetches and the shared query layer across settings tabs.
- Done: started the oversized bookings/client split work by extracting the audit history UI and diff logic from `components/bookings/booking-detail-client.tsx` into `components/bookings/booking-audit-timeline.tsx`, shrinking one of the larger booking detail surfaces without changing the booking edit or status flows.
- Done: continued the oversized bookings cleanup in `components/bookings/booking-checkin-client.tsx` by extracting shared React Query hooks in `hooks/use-charge-rate-query.ts` and `hooks/use-booking-checkin-invoice-query.ts`, and by moving default tax-rate, charge-rate, and finalized-invoice loading off local raw `useEffect` fetch blocks and onto the shared query layer.
- Done: continued shrinking `components/bookings/booking-checkin-client.tsx` by extracting the finalized invoice summary and line-item table into `components/bookings/finalized-invoice-card.tsx`, leaving the main check-in client with less embedded read-only invoice display markup.
- Done: continued the scheduler/settings data-loading cleanup in `components/scheduler/new-booking-modal.tsx` by introducing `hooks/use-booking-options-query.ts` and `hooks/use-member-training-peek-query.ts`, moving booking-options and member-training-peek loading off local raw fetch effects and reusing the same training-peek query path in `components/bookings/member-training-peek.tsx`.
- Done: continued the scheduler modal split by extracting availability and recurring-conflict loading into `hooks/use-booking-availability.ts`, so `components/scheduler/new-booking-modal.tsx` no longer owns the raw async availability state machine directly.
- Done: continued shrinking `components/scheduler/new-booking-modal.tsx` by extracting the booking-mode tabs into `components/scheduler/new-booking-mode-tabs.tsx` and the trial guest details block into `components/scheduler/trial-guest-details-section.tsx`, removing two self-contained booking-mode UI sections from the main modal file.
- Done: continued the modal split by extracting the recurring booking toggle, repeat-day selector, until-date picker, and occurrence conflict summary from `components/scheduler/new-booking-modal.tsx` into `components/scheduler/recurring-booking-section.tsx`, leaving the main modal with less embedded recurring-booking control flow and render markup.
- Done: continued the oversized scheduler split by extracting the pending move confirmation dialog from `components/scheduler/resource-timeline-scheduler.tsx` into `components/scheduler/pending-booking-move-dialog.tsx`, reducing one of the larger JSX/control blocks on the main timeline surface.
- Done: continued the scheduler architecture cleanup by extracting booking status-update and drag-move mutation handling from `components/scheduler/resource-timeline-scheduler.tsx` into `hooks/use-scheduler-booking-actions.ts`, reducing more imperative mutation and refresh orchestration inside the main timeline component.
- Done: continued the scheduler surface split by extracting the timeline date-navigation and create-booking toolbar from `components/scheduler/resource-timeline-scheduler.tsx` into `components/scheduler/resource-timeline-toolbar.tsx`, shrinking another top-level JSX block on the main scheduler view.
- Done: continued the scheduler render split by extracting the resource sidebar from `components/scheduler/resource-timeline-scheduler.tsx` into `components/scheduler/resource-timeline-sidebar.tsx`, removing another large JSX block from the main timeline surface while preserving the existing create-booking interactions.
- Done: continued the scheduler render split by extracting the timeline header/grid shell from `components/scheduler/resource-timeline-scheduler.tsx` into `components/scheduler/resource-timeline-grid.tsx`, leaving the main scheduler component with less repeated render scaffolding around the row content.
- Done: continued flattening the scheduler render path by extracting shared row-section mapping into `components/scheduler/resource-timeline-section.tsx`, reducing duplicated instructor/aircraft row rendering structure in the main timeline component.
- Done: continued the deepest scheduler render split by extracting the booking tile, preview badge, tooltip, and context-menu UI from `TimelineRow` into `components/scheduler/booking-timeline-item.tsx`, leaving the row component with less embedded interactive card markup.
- Done: continued the row-level scheduler split by extracting the timeline row surface grid, hover indicator, and empty-slot interaction shell from `TimelineRow` into `components/scheduler/resource-timeline-row-surface.tsx`, leaving the row component more focused on composing the background surface with booking items.
- Done: continued the scheduler split by extracting `TimelineRow` from `components/scheduler/resource-timeline-scheduler.tsx` into `components/scheduler/resource-timeline-row.tsx`, so the main scheduler file now focuses more on data orchestration and less on per-row render composition.
- Done: fixed the extracted booking timeline item badge typing in `components/scheduler/booking-timeline-item.tsx` to use `Badge`'s actual variant contract, resolving the TypeScript variant mismatch surfaced after the scheduler extraction.
- Done: fixed a scheduler modal hook-order regression in `components/scheduler/new-booking-modal.tsx` by moving availability-derived selection filtering below the `useBookingAvailability` call, resolving the runtime `Cannot access 'unavailableAircraftIds' before initialization` error on scheduler page load.
- Done: moved tenant-logo signed URL generation behind an explicit privileged module in `lib/settings/logo-storage-admin.ts`, and updated settings/invoicing loaders to use it.
- Done: tightened the top-level settings architecture contract by making `app/settings/page.tsx` own initial tab selection, removing `ssr: false` wrappers from the main settings tabs in `components/settings/settings-page-client.tsx`, and keeping server-bootstrapped forms such as `components/settings/bookings-tab.tsx` and `components/settings/memberships/membership-year-config.tsx` on the server-provided payload instead of mount-time refetches.
- Done: continued the client-owned settings-editor cleanup with `hooks/use-landing-fees-query.ts` and `hooks/use-membership-types-query.ts`, moving `components/settings/charges/landing-fees-config.tsx` and `components/settings/memberships/membership-types-config.tsx` off bespoke list-loading helpers and onto shared query/invalidation patterns.
- Done: extended the same query/invalidation cleanup across the training config editors with `hooks/use-experience-types-query.ts`, `hooks/use-syllabi-query.ts`, `hooks/use-endorsements-query.ts`, and `hooks/use-exams-query.ts`, so `components/settings/training/experience-types-config.tsx`, `components/settings/training/syllabus-config.tsx`, `components/settings/training/endorsements-config.tsx`, and `components/settings/training/exams-config.tsx` no longer own mount-time list fetch/reload helpers.
- Done: continued the remaining settings-editor normalization with `hooks/use-chargeables-admin-query.ts`, `hooks/use-flight-types-query.ts`, `hooks/use-cancellation-categories-query.ts`, and `hooks/use-tax-rates-query.ts`, moving `components/settings/charges/chargeables-config.tsx`, `components/settings/charges/flight-types-config.tsx`, `components/settings/bookings/cancellation-categories-config.tsx`, and `components/settings/tax-rate-manager.tsx` onto shared query/invalidation flows; tax-rate changes now also invalidate the shared default-tax-rate query used elsewhere in settings.
- Done: normalized the lessons-specific data path with `hooks/use-lessons-query.ts`, moving `components/settings/training/lessons-tab.tsx` and `components/settings/training/lessons/lesson-modal.tsx` onto the same shared syllabi/lessons query-key contract as the rest of training settings, including consistent invalidation after create, edit, delete, and reorder actions.
- Deferred: splitting oversized client components.
- Deferred: deeper cleanup of the client-owned settings editors to further reduce overlap between raw fetches, shared query hooks, and other client state layers.
