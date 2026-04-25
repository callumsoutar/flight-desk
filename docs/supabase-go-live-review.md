# Supabase Go-Live Review

Date: 2026-04-26  
Project: `flight-service-pro` (`fergmobsjyucucxeumvb`)  
Region: `ap-southeast-2`  
Database: Supabase Postgres `17.4.1.054`  
Reviewer posture: strict final production readiness gate; live checks used Supabase MCP read-only SQL and Auth logs only.

## Launch Recommendation

**GO WITH WARNINGS**

The critical tenant-isolation checks for `public.bookings` and the privileged booking/finance RPCs passed. The live access-token hook exists, is granted only to `supabase_auth_admin`/service roles, has recent successful Auth log executions, and emits the `tenant_id` and `app_role` claims expected by the application middleware/session code.

No critical or high cross-tenant booking/finance mutation path was confirmed. However, several privileged SECURITY DEFINER functions remain executable by `anon`/`public`, and Supabase security advisors report outstanding hardening items. These do not currently bypass the internal tenant checks observed in the audited critical paths, but the public RPC surface should be reduced before broad public exposure.

## Verification Summary

| Check | Status | Risk | Notes |
| --- | --- | --- | --- |
| `public.bookings` RLS policies | PASS | Critical | RLS is enabled. SELECT is tenant-scoped via `user_belongs_to_tenant(tenant_id)`. INSERT/UPDATE/DELETE are tenant-bound and staff/user gated. No catch-all policy observed. |
| `check_user_role_simple` overload audit | PASS | Critical | Tenant-scoped 3-argument overload exists. Audited SECURITY DEFINER booking/finance callers use tenant-aware role checks or equivalent tenant-scoped predicates. The 2-argument overload still exists and should be retired when compatibility allows. |
| `finalize_booking_checkin_with_invoice_atomic` | PASS | Critical | Loads booking tenant from `bookings`, requires authenticated user, checks membership and tenant-scoped staff role, validates invoice and aircraft tenant alignment before writes. |
| `uncancel_booking` | PASS | Critical | Requires `auth.uid()`, loads tenant from booking row, verifies tenant membership and tenant-scoped owner/admin/instructor role before restoring. |
| `record_invoice_payment_atomic` | PASS | Critical | Resolves invoice tenant server-side, verifies membership and tenant-scoped staff role, writes transactions/payments/invoice updates using the resolved tenant. |
| Access token hook | PASS | High | `public.flightdesk_access_token_hook(jsonb)` exists, matches expected SQL shape, Auth logs show recent successful `pg-functions://postgres/public/flightdesk_access_token_hook` executions, and sampled hook output includes non-null `tenant_id` and `app_role`. |
| Xero OAuth security dependencies | PASS | High | Callback persists with authenticated tenant context from `getTenantAdminRouteContext`; decoded OAuth state contains only nonce/timestamp and is not trusted for tenant identity. DB-side Xero RLS is tenant/admin-scoped. |
| Grants and SECURITY DEFINER exposure | WARNING | High | Critical functions enforce tenant validation internally, but multiple privileged SECURITY DEFINER functions remain executable by `anon`/`public`, including booking/invoice RPCs. Reduce grants to least privilege. |
| Supabase security advisors | WARNING | Medium | Advisors report `pg_net` in `public`, leaked password protection disabled, and available Postgres security patches. |

## Detailed Findings

### PASS: `public.bookings` RLS policies

Affected object: `public.bookings`

Live finding:

- `bookings_tenant_select`: `user_belongs_to_tenant(tenant_id)`
- `bookings_tenant_insert`: `user_belongs_to_tenant(tenant_id)` and either own booking user or tenant staff role.
- `bookings_tenant_update`: `user_belongs_to_tenant(tenant_id)` and either tenant staff role or own booking user, with the same predicate in `WITH CHECK`.
- `bookings_tenant_delete`: `user_belongs_to_tenant(tenant_id)` and tenant owner/admin/instructor role.

Risk explanation:

The live policies are tenant-bound. No unrestricted read/write policy or cross-tenant write predicate was observed.

Recommended remediation SQL:

None required for launch.

### PASS: `check_user_role_simple` overloads and callers

Affected object: `public.check_user_role_simple`

Live finding:

Two overloads exist:

- `check_user_role_simple(uuid,user_role[])`
- `check_user_role_simple(uuid,uuid,user_role[])`

The 3-argument overload explicitly filters `tenant_users.tenant_id = p_tenant_id`. Audited SECURITY DEFINER booking/finance callers use tenant-aware calls such as `check_user_role_simple(v_actor, v_tenant_id, ARRAY[...])`, `check_user_role_simple(v_actor, v_invoice.tenant_id, ARRAY[...])`, or equivalent tenant-bound membership predicates.

Risk explanation:

The tenant-agnostic 2-argument overload remains deployed. It is not a confirmed launch blocker because audited privileged booking/finance paths do not rely on it for tenant data authorization, but keeping it available increases future regression risk.

Recommended remediation SQL:

Schedule after confirming no remaining application or policy dependency uses the 2-argument form:

```sql
revoke execute on function public.check_user_role_simple(uuid, public.user_role[]) from anon, authenticated, public;

-- Optional later cleanup after dependency verification:
-- drop function public.check_user_role_simple(uuid, public.user_role[]);
```

### PASS: `finalize_booking_checkin_with_invoice_atomic`

Affected object: `public.finalize_booking_checkin_with_invoice_atomic`

Live finding:

The function:

- requires `auth.uid()`;
- loads `bookings.tenant_id` from `p_booking_id`;
- verifies `user_belongs_to_tenant(v_tenant_id)`;
- checks `check_user_role_simple(v_actor, v_tenant_id, ARRAY['admin','owner','instructor'])`;
- rejects invoices whose `tenant_id` differs from the booking tenant;
- rejects aircraft whose `tenant_id` differs from the booking tenant;
- performs booking/aircraft writes only after these checks.

Risk explanation:

No ID-only finance mutation path was found in this function.

Recommended remediation SQL:

No tenant-isolation remediation required for launch. See grant hardening below.

### PASS: `uncancel_booking`

Affected object: `public.uncancel_booking`

Live finding:

The function requires `auth.uid()`, loads booking status and tenant from the row, verifies active membership in that tenant, checks tenant-scoped owner/admin/instructor role, then restores only a cancelled booking.

Risk explanation:

Knowledge of a booking UUID alone is insufficient to uncancel a booking.

Recommended remediation SQL:

No tenant-isolation remediation required for launch.

### PASS: `record_invoice_payment_atomic`

Affected object: `public.record_invoice_payment_atomic`

Live finding:

The function resolves `v_tenant_id` from `public.invoices`, rejects missing/deleted invoices, verifies active tenant membership, verifies tenant-scoped owner/admin/instructor role, and updates `public.invoices` with `WHERE id = p_invoice_id AND tenant_id = v_tenant_id`.

Risk explanation:

No invoice ID-only payment mutation path was found.

Recommended remediation SQL:

No tenant-isolation remediation required for launch.

### PASS: Access token hook

Affected object: `public.flightdesk_access_token_hook(jsonb)`

Live finding:

The function exists as SECURITY DEFINER with `search_path = ''`, calls `get_user_tenant(v_user_id)` and `get_tenant_user_role(v_user_id)`, and sets `claims.tenant_id` and `claims.app_role`. Grants are restricted to `postgres`, `service_role`, and `supabase_auth_admin`; `anon`, `authenticated`, and `public` cannot execute it directly.

Auth logs from the last 24 hours include successful hook executions:

- hook: `pg-functions://postgres/public/flightdesk_access_token_hook`
- message: `Hook ran successfully`
- path: `/token`
- grant type: `refresh_token`

Sampled active tenant users returned non-null `tenant_id` and `app_role` from the hook.

Risk explanation:

The application middleware accepts `app_role` or `role`; the hook emits `app_role`, and session code resolves tenant from `tenant_id`. Hook enablement was confirmed through live Auth logs rather than a Dashboard setting export.

Recommended remediation SQL:

None required for launch.

### PASS: Xero OAuth security dependencies

Affected objects:

- `public.xero_connections`
- `public.xero_invoices`
- `public.xero_export_logs`
- `app/api/xero/callback/route.ts`

Live finding:

The Xero callback writes using `tenantId` from authenticated tenant-admin route context, not from decoded OAuth state. The decoded state contains only `nonce` and `timestamp`. Live RLS policies for Xero tables are tenant-bound and admin-scoped where writes are allowed.

Risk explanation:

No DB-side tenant trust in client-provided OAuth state was observed. The remaining state-cookie design is weaker than a server-side nonce store but is not a confirmed tenant-isolation blocker.

Recommended remediation SQL:

No SQL required for launch. If server-side nonce persistence is added later, use a short-lived nonce table bound to tenant, user, session, expiry, and single-use consumption.

### WARNING: Grants and SECURITY DEFINER exposure

Affected objects include:

- `public.finalize_booking_checkin_with_invoice_atomic(...)`
- `public.create_invoice_atomic(...)`
- `public.approve_booking_checkin_atomic(...)`
- `public.void_invoice_atomic(...)`
- `public.check_user_role_simple(...)`
- helper/trigger functions in `public`

Live finding:

Some privileged SECURITY DEFINER functions involved in booking and finance flows are executable by `anon`/`public`. The most important finding is:

- `finalize_booking_checkin_with_invoice_atomic(...)`: `anon_can_execute = true`, `public_can_execute = true`, `authenticated_can_execute = true`

Other finance/booking functions with broad anon/public execute grants include `create_invoice_atomic(...)`, `approve_booking_checkin_atomic(...)`, `void_invoice_atomic(...)`, and several helper/trigger functions.

Risk explanation:

The audited critical functions reject unauthenticated callers with `auth.uid()` checks and enforce tenant-scoped authorization internally, so this is not a confirmed cross-tenant mutation path. It is still an unnecessarily broad privileged RPC surface in an exposed schema and should be tightened to reduce misuse, probing, and future regression blast radius.

Recommended remediation SQL:

Apply after confirming the frontend/API only calls these RPCs as authenticated users and that trigger-only functions are not directly called by application code:

```sql
revoke execute on function public.finalize_booking_checkin_with_invoice_atomic(
  uuid, uuid, uuid, uuid, uuid,
  numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, text, numeric
) from anon, public;

revoke execute on function public.create_invoice_atomic(
  uuid, uuid, text, text, numeric, timestamp with time zone,
  timestamp with time zone, text, jsonb
) from anon, public;

revoke execute on function public.approve_booking_checkin_atomic(
  uuid, uuid, uuid, uuid,
  numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, text, numeric, numeric,
  timestamp with time zone, text, jsonb
) from anon, public;

revoke execute on function public.void_invoice_atomic(uuid, text) from anon, public;

-- Keep authenticated execute only for RPCs intentionally called by signed-in users.
grant execute on function public.finalize_booking_checkin_with_invoice_atomic(
  uuid, uuid, uuid, uuid, uuid,
  numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, text, numeric
) to authenticated;
```

For trigger-only functions, prefer revoking all client roles:

```sql
revoke execute on function public.prevent_approved_invoice_modification() from anon, authenticated, public;
revoke execute on function public.prevent_approved_invoice_item_modification() from anon, authenticated, public;
revoke execute on function public.prevent_invoice_payment_delete() from anon, authenticated, public;
revoke execute on function public.prevent_xero_invoice_delete() from anon, authenticated, public;
```

### WARNING: Supabase security advisors

Affected objects/settings:

- extension `pg_net` in `public`
- Supabase Auth leaked password protection
- Supabase Postgres patch level

Live finding:

Supabase security advisors returned:

- `extension_in_public`: `pg_net` is installed in `public`.
- `auth_leaked_password_protection`: leaked password protection is disabled.
- `vulnerable_postgres_version`: current Postgres version has security patches available.

Risk explanation:

These are platform hardening warnings rather than confirmed tenant-isolation failures. They should still be scheduled before or immediately after launch because this is a production SaaS handling aviation and finance workflows.

Recommended remediation SQL/settings:

Move `pg_net` to a non-exposed schema only after checking dependencies:

```sql
create schema if not exists extensions;
alter extension pg_net set schema extensions;
```

Enable leaked password protection in Supabase Auth settings.

Schedule the Supabase Postgres upgrade through the Supabase platform upgrade workflow.

## Evidence Queries Run

Representative read-only checks included:

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'bookings'
order by cmd, policyname;
```

```sql
select p.oid::regprocedure as signature, p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'check_user_role_simple',
    'finalize_booking_checkin_with_invoice_atomic',
    'uncancel_booking',
    'record_invoice_payment_atomic',
    'flightdesk_access_token_hook'
  )
order by p.proname, p.oid::regprocedure::text;
```

```sql
select p.oid::regprocedure as signature,
       p.prosecdef as security_definer,
       coalesce(p.proacl::text, '<default>') as acl,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
       has_function_privilege('public', p.oid, 'execute') as public_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'finalize_booking_checkin_with_invoice_atomic',
    'uncancel_booking',
    'record_invoice_payment_atomic',
    'flightdesk_access_token_hook',
    'check_user_role_simple'
  )
order by p.proname, p.oid::regprocedure::text;
```

```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'invoices',
    'invoice_items',
    'invoice_payments',
    'transactions',
    'xero_invoices',
    'xero_connections',
    'xero_export_logs',
    'aircraft'
  )
order by tablename, cmd, policyname;
```

