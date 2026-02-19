# JWT Claims Migration Playbook

This document is the safe rollout plan for Flight Desk to move tenant/role resolution from per-request DB RPCs to JWT claims.

## Current implementation status (code complete)
- Middleware auth is claims-only (`getClaims()`), no `getUser()` fallback in middleware.
- `lib/auth/session.ts` is now claims-first for both role and tenant:
  - Role: `app_role`/claim-based first, DB fallback only when needed.
  - Tenant: `tenant_id`/claim-based first, DB fallback only when needed.
- App routes no longer call `getUserTenantId(...)` directly.
- High-stakes mutations use authoritative checks (`requireUser: true`) and authoritative tenant/role resolution where needed.
- Optional strict mode exists:
  - `AUTH_CLAIMS_STRICT=true` disables non-authoritative DB fallback for role/tenant.
  - `AUTH_LOG_CLAIMS_FALLBACKS=true` logs when fallback is still being used.

## Claims contract (what app code expects)
- `sub`: Supabase user id.
- `tenant_id`: active tenant id for request scoping.
- `app_role`: one of `owner|admin|instructor|member|student`.

Notes:
- Keep Supabase JWT `role` claim for DB role semantics (`authenticated`, etc.).
- App authorization should read `app_role`.

## Step 1: Configure Supabase Access Token Hook
Use a Postgres hook to set `tenant_id` and `app_role` in issued access tokens.
Ready-to-run SQL lives in `docs/sql/access-token-hook.sql`.

```sql
create or replace function public.flightdesk_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  v_user_id uuid;
  v_tenant_id text;
  v_app_role text;
begin
  v_user_id := (event->>'user_id')::uuid;
  claims := coalesce(event->'claims', '{}'::jsonb);

  -- Reuse existing source-of-truth functions in this project.
  select public.get_user_tenant(v_user_id) into v_tenant_id;
  select public.get_tenant_user_role(v_user_id) into v_app_role;

  claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id), true);
  claims := jsonb_set(claims, '{app_role}', to_jsonb(v_app_role), true);

  event := jsonb_set(event, '{claims}', claims, true);
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.flightdesk_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.flightdesk_access_token_hook(jsonb) from anon, authenticated, public;
```

Then enable it in Supabase Dashboard:
- `Authentication -> Hooks -> Access Token Hook`.
- Select `public.flightdesk_access_token_hook`.

## Step 2: Deploy with fallback still enabled (safe mode)
- Keep `AUTH_CLAIMS_STRICT` unset (or `false`).
- Optionally set `AUTH_LOG_CLAIMS_FALLBACKS=true` temporarily.
- Force token refresh/re-login for existing users so new tokens include the claims.

## Step 3: Validate claim coverage
Validate in production logs and behavior:
- No auth failures on protected routes.
- `tenant_id` and `app_role` present for active users.
- Fallback logs trend toward zero.

Quick repository checks:
- `rg -n "getUserTenantId" app` should return no results.
- `rg -n "includeTenant" app` should show all tenant-scoped pages/routes/actions using session helper.

## Step 4: Cut over to strict claims mode
After fallback usage is effectively zero:
- Set `AUTH_CLAIMS_STRICT=true`.
- Keep monitoring for any missing-claim users.

In strict mode:
- Non-authoritative reads rely on claims only.
- Authoritative paths still use DB checks when explicitly requested.

## Step 5: Keep authoritative checks for high-stakes mutations
Do not remove authoritative checks from sensitive paths:
- Booking create/update status paths.
- Instructor and roster mutation actions.
- Member mutation actions that change tenant-bound records.

## Rollback plan
If rollout issues appear:
1. Set `AUTH_CLAIMS_STRICT=false`.
2. Keep hook enabled while investigating claim gaps.
3. Re-issue sessions for affected users.

This keeps app auth functional while preserving security (RLS still enforced).
