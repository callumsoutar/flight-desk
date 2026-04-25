# Supabase Follow-Up Review

No schema, SQL, policy, auth-hook, or environment changes were made in this sprint. This document tracks the remaining live-project verification and deferred infrastructure work that still needs a Supabase or deployment review before production cutover.

## 1. Live `bookings` RLS verification

Issue summary:
Confirm the deployed `bookings` policies still match the intended tenant isolation and staff-write rules. This was not verified in this sprint because no live SQL was run.

Affected DB objects/functions/policies:
`public.bookings`
`pg_policies`

Exact files related to the issue:
`docs/sql/production-readiness-queries.sql`
`docs/production-readiness-audit.md`
`docs/security-deployment-audit-2026-04-26.md`
`app/bookings/actions.ts`

Verification steps:
Run:
```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'bookings'
order by cmd, policyname;
```
Review the returned `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies against current product intent.

Expected safe outcomes:
`SELECT` is intentionally scoped for your privacy model.
`INSERT`, `UPDATE`, and `DELETE` are tenant-bound and staff-gated where required.
No permissive catch-all policy allows cross-tenant visibility or writes.

Recommended SQL or policy changes:
If any write policy is broader than intended, tighten it to explicit tenant and role predicates.
If `SELECT` is broader than intended, narrow it to own-row or staff-only access as required by product policy.

Deployment risk if unresolved:
Incorrect live policy state can allow unauthorized booking reads or writes even when the application code looks correct.

Priority:
`high`

Severity if verification fails:
`critical`

## 2. `check_user_role_simple` overload audit

Issue summary:
Live overload definitions for `check_user_role_simple` must be verified to ensure SECURITY DEFINER functions are not still relying on the tenant-agnostic two-argument form.

Affected DB objects/functions/policies:
`public.check_user_role_simple`
`pg_proc`

Exact files related to the issue:
`docs/sql/production-readiness-queries.sql`
`docs/production-readiness-audit.md`
`docs/production-readiness-remediation-2026-03-28.md`
`lib/types/database.ts`

Verification steps:
Run:
```sql
select p.oid::regprocedure as signature, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'check_user_role_simple'
order by 1;
```
For every returned overload, inspect the function body with `pg_get_functiondef` and confirm whether tenant scoping is enforced.

Expected safe outcomes:
The three-argument overload exists and scopes membership checks to the supplied tenant.
Any SECURITY DEFINER caller that can touch tenant data uses the three-argument overload or equivalent tenant-bound logic.

Recommended SQL or policy changes:
Replace any remaining SECURITY DEFINER callers that use `check_user_role_simple(user_id, allowed_roles[])` with the three-argument tenant-scoped overload.

Deployment risk if unresolved:
An id-based DEFINER function could authorize against the wrong tenant and mutate finance or booking data across tenant boundaries.

Priority:
`high`

Severity if verification fails:
`critical`

## 3. `finalize_booking_checkin_with_invoice_atomic` live definition check

Issue summary:
The live RPC definition must still reflect the hardened tenant-bound version after deployment.

Affected DB objects/functions/policies:
`public.finalize_booking_checkin_with_invoice_atomic`

Exact files related to the issue:
`docs/sql/production-readiness-queries.sql`
`docs/production-readiness-audit.md`
`docs/production-readiness-remediation-2026-03-28.md`
`docs/finance-system-implementation-plan.md`

Verification steps:
Run:
```sql
select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'finalize_booking_checkin_with_invoice_atomic';
```
Confirm the function loads `bookings.tenant_id`, uses tenant-membership validation, uses the three-argument `check_user_role_simple`, and rejects invoice or aircraft rows from another tenant.

Expected safe outcomes:
The function authorizes against the booking tenant, not just the caller or supplied IDs.
Invoice and aircraft rows are explicitly matched to the booking tenant before writes occur.

Recommended SQL or policy changes:
Reapply the hardened migration if the live function body does not include explicit tenant alignment and tenant-scoped role checks.

Deployment risk if unresolved:
Booking finalization could attach or mutate tenant-mismatched financial records.

Priority:
`high`

Severity if verification fails:
`critical`

## 4. `uncancel_booking` live definition check

Issue summary:
The deployed `uncancel_booking` function still needs a live-body verification pass.

Affected DB objects/functions/policies:
`public.uncancel_booking`

Exact files related to the issue:
`docs/sql/production-readiness-queries.sql`
`docs/production-readiness-audit.md`
`docs/production-readiness-remediation-2026-03-28.md`

Verification steps:
Run:
```sql
select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'uncancel_booking';
```
Confirm the function requires `auth.uid()`, tenant membership for the booking tenant, and a tenant-scoped staff role check before restoring the booking.

Expected safe outcomes:
Only authorized staff in the booking’s tenant can uncancel a booking.
The function body cannot succeed based on row ID knowledge alone.

Recommended SQL or policy changes:
Restore the hardened tenant-bound function definition if the live body lacks tenant membership validation or uses the two-argument role helper.

Deployment risk if unresolved:
Cross-tenant or under-authorized booking restoration remains possible in the live database.

Priority:
`high`

Severity if verification fails:
`critical`

## 5. `record_invoice_payment_atomic` live definition check

Issue summary:
Payment recording still requires live verification because it is a high-impact SECURITY DEFINER finance path.

Affected DB objects/functions/policies:
`public.record_invoice_payment_atomic`

Exact files related to the issue:
`docs/sql/production-readiness-queries.sql`
`docs/production-readiness-audit.md`
`docs/production-readiness-remediation-2026-03-28.md`
`app/invoices/[id]/actions.ts`

Verification steps:
Run:
```sql
select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'record_invoice_payment_atomic';
```
Confirm the live function resolves the invoice tenant, uses tenant-scoped authorization, and never relies on an invoice ID alone without tenant alignment.

Expected safe outcomes:
The function uses the tenant-bound three-argument helper or an equivalent tenant check.
The invoice row selected for update is guaranteed to belong to the caller’s tenant.

Recommended SQL or policy changes:
If the live body still relies on the two-argument helper or lacks explicit tenant alignment, replace it with the hardened tenant-bound definition before production rollout.

Deployment risk if unresolved:
Finance mutations may be authorized against the wrong tenant in a privileged function.

Priority:
`high`

Severity if verification fails:
`critical`

## 6. Access token hook verification

Issue summary:
Application auth depends on JWT claims carrying `tenant_id` and role information. The live custom access token hook must exist and be enabled.

Affected DB objects/functions/policies:
`public.flightdesk_access_token_hook`
Supabase Auth custom access token hook configuration

Exact files related to the issue:
`docs/sql/production-readiness-queries.sql`
`docs/sql/access-token-hook.sql`
`docs/production-readiness-audit.md`
`lib/auth/session.ts`
`lib/supabase/middleware.ts`

Verification steps:
Run:
```sql
select p.oid::regprocedure
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'flightdesk_access_token_hook';
```
Then confirm in Supabase Dashboard that the custom access token hook is enabled for the production project and matches `docs/sql/access-token-hook.sql`.

Expected safe outcomes:
The function exists in `public`.
The hook is enabled in Auth settings.
Issued JWTs contain the claims required by `lib/auth/session.ts` and `lib/supabase/middleware.ts`.

Recommended SQL or policy changes:
Deploy or reapply the hook SQL if the function is missing.
Enable the hook in Dashboard if the function exists but is not active.

Deployment risk if unresolved:
Users can receive tokens with missing tenant or role claims, causing broken authorization flows or stale privilege behavior.

Priority:
`high`

Severity if verification fails:
`high`

## 7. Xero OAuth state hardening follow-up

Issue summary:
The Xero callback now ignores tenant identity from OAuth state and only trusts authenticated server session context. Remaining hardening opportunity: move OAuth state from a client-stored cookie echo to server-side nonce storage.

Affected DB objects/functions/policies:
No current DB object. If implemented later, use a dedicated short-lived server-side session or nonce store.

Exact files related to the issue:
`app/api/xero/connect/route.ts`
`app/api/xero/callback/route.ts`
`docs/security-deployment-audit-2026-04-26.md`

Verification steps:
Confirm the callback only writes with the authenticated tenant from server session context.
Decide whether production should add server-side nonce persistence for OAuth state replay protection and auditability.

Expected safe outcomes:
No privileged write depends on decoded OAuth state.
If additional hardening is desired, nonce validation happens against a server-controlled store instead of only a cookie value.

Recommended SQL or policy changes:
If you choose to persist OAuth nonces in Supabase later, use a short-lived table keyed by nonce with tenant/user/session binding and TTL cleanup.

Deployment risk if unresolved:
Current application risk is reduced because tenant binding no longer trusts decoded state, but cookie-backed state remains a weaker design than a server-side nonce store.

Priority:
`medium`

Severity if verification fails:
`medium`

## 8. Rate limiting deferred by request

Issue summary:
The current rate limiter remains instance-local and in-memory. This sprint intentionally left it unchanged per implementation direction.

Affected DB objects/functions/policies:
None yet.

Exact files related to the issue:
`lib/security/rate-limit.ts`
`docs/security-deployment-audit-2026-04-26.md`

Verification steps:
Choose whether production rate limiting should use Redis, Upstash, or another shared backend.
Validate the chosen backend supports shared counters, TTL-based resets, and failure handling that does not block critical user flows.

Expected safe outcomes:
Rate limiting is backed by shared infrastructure before horizontal scaling or multi-instance deployment.

Recommended SQL or policy changes:
No SQL recommended in this sprint.
If Supabase-backed rate limiting is considered later, design it separately and validate abuse-volume impact before implementation.

Deployment risk if unresolved:
Rate limits can be bypassed across instances, after restarts, or under scale-out conditions.

Priority:
`medium`

Severity if verification fails:
`medium`

## 9. Residual upstream production advisories after patching

Issue summary:
Production npm audit is now at zero high and zero critical advisories. Three moderate advisories remain, all tied to the latest published `next@16.2.4` dependency chain (`next` -> bundled `postcss`) and its effect on `@vercel/speed-insights`.

Affected DB objects/functions/policies:
None.

Exact files related to the issue:
`package.json`
`package-lock.json`
`next.config.ts`

Verification steps:
Run:
```bash
npm audit --omit=dev --audit-level=high
```
Confirm the result remains at zero high and zero critical advisories.
Run:
```bash
npm audit --omit=dev
```
Review the remaining moderate advisories for:
`next`
`postcss`
`@vercel/speed-insights`

Expected safe outcomes:
No high or critical production advisories remain.
The only residual advisories are the current upstream `next`/`postcss` branch on the latest published Next.js release line.

Recommended SQL or policy changes:
None.
Track upstream Next.js releases and remove this exception when a fixed `postcss` bundle ships.

Deployment risk if unresolved:
Residual moderate risk remains in upstream framework dependencies, but the production blocker class from the audit is cleared.

Priority:
`medium`

Severity if verification fails:
`medium`
