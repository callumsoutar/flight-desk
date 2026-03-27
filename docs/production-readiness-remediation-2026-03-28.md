# Production readiness remediation tracker — 2026-03-28

## Goal

Ship a production-ready build today by closing critical RLS, tenant-isolation, and migration-drift gaps identified in:

- `docs/production-readiness-audit.md`
- prior incident transcript: [member creation RLS incident](dbd59528-a0cf-483e-9d31-69b895b679e4)

## Current decision

Current state is **GO / Deploy with caution** based on completed critical remediations and verified live database state.

## Evidence snapshot (live Supabase via MCP)

- Project: `fergmobsjyucucxeumvb` (`flight-service-pro`)
- Migration drift item reconciled in repo: `20260327025239 fix_member_creation_users_rls`
- `users_select` bug fixed (`tu_target.user_id = users.id`)
- 2-arg and 3-arg `check_user_role_simple` overloads both exist
- `record_invoice_payment_atomic` and `record_member_credit_payment_atomic` now use tenant-scoped 3-arg role checks
- Final cleanup migration applied in live history: `20260327221726 final_cleanup_advisors_partial`
- Confirmed: `email_logs_triggered_by_fkey` now has covering index `idx_email_logs_triggered_by`
- Confirmed: flagged `auth_rls_initplan` policies (`roles_read_active`, `email_trigger_configs_insert`, `email_trigger_configs_update`) now use `(SELECT auth.uid())`

## Checklist

### Critical (must finish before release)

- [x] Add missing migration to repo for member creation RLS hardening (source of production drift).
- [x] Fix `users_select` policy bug (`tu.user_id = tu.id`) to proper target-user binding.
- [x] Ensure `tenant_users_insert` policy includes instructor (matches staff routes).
- [x] Ensure `users_insert` policy uses tenant-agnostic staff existence check (multi-tenant safe).
- [x] Harden `record_invoice_payment_atomic` to tenant-bound authorization (3-arg helper + tenant check).
- [x] Apply new migration to production Supabase project.
- [x] Re-run live DB verification queries (`pg_policies`, `pg_get_functiondef`, migrations parity).

### Important (finish today if possible)

- [x] Make member creation API resilient to partial-write failure (`users` created but `tenant_users` fails).
- [x] Re-run Supabase `get_advisors` and triage top security warnings.
- [x] Capture final go/no-go summary in this doc with deployment recommendation.
- [x] Harden remaining high-impact SECURITY DEFINER functions still using 2-arg role helper.

## Execution log

- 2026-03-28: Created remediation tracker and aligned scope with live Supabase findings.
- 2026-03-28: Added migration `supabase/migrations/20260327215738_production_readiness_rls_finance_hardening.sql` with users/tenant_users RLS fixes and `record_invoice_payment_atomic` tenant hardening.
- 2026-03-28: Updated `app/api/members/route.ts` with best-effort rollback via admin client when tenant membership creation fails after creating a new user profile.
- 2026-03-28: Applied migration to live Supabase (`production_readiness_rls_finance_hardening`) and verified:
  - `users_select` now binds orphan check to `users.id` (`tu_target.user_id = users.id`)
  - `tenant_users_insert` includes `instructor`
  - `record_invoice_payment_atomic` uses 3-arg `check_user_role_simple(v_actor, v_tenant_id, ...)`
  - migration appears in live history as `20260327215738`
- 2026-03-28: Added and applied `harden_member_credit_payment_tenant_scope` (live version `20260327220210`) so `record_member_credit_payment_atomic` now uses 3-arg role checks scoped to actor tenant and writes `transactions.tenant_id` explicitly.
- 2026-03-28: Added and applied `harden_finance_admin_definer_tenant_scope` (live version `20260327220732`) so these functions now use tenant-scoped role checks:
  - `admin_correct_invoice`
  - `create_invoice_atomic`
  - `update_invoice_status_atomic`
  - `reverse_invoice_payment_atomic`
  - `void_and_reissue_xero_invoice`
- 2026-03-28: Re-ran advisor checks and re-triaged open warnings (`pg_net` in `public`, leaked password protection disabled, Postgres patch upgrade available).
- 2026-03-28: Added and applied `harden_remaining_definer_role_checks` (live version `20260327221215`) covering:
  - `approve_booking_checkin_atomic`
  - `correct_booking_checkin_ttis_atomic`
  - `update_aircraft_current_meters`
  - `prevent_approved_invoice_item_modification`
  - `prevent_approved_invoice_modification`
- 2026-03-28: Verified no remaining SECURITY DEFINER functions in `public` using 2-arg `check_user_role_simple(user_id, allowed_roles[])`.
- 2026-03-28: Added and applied `final_cleanup_advisors_partial` (live version `20260327221726`) to:
  - add `idx_email_logs_triggered_by` covering index for `email_logs_triggered_by_fkey`
  - rewrite `roles_read_active`, `email_trigger_configs_insert`, and `email_trigger_configs_update` with `(SELECT auth.uid())` initplan pattern
- 2026-03-28: Attempted to move `pg_net` out of `public`, but Postgres returned `extension "pg_net" does not support SET SCHEMA`; documented as manual/platform-level exception.

## Remaining blockers for final SAFE decision

- Supabase security advisor warnings still open:
  - `pg_net` extension in `public` schema
  - leaked password protection disabled
  - Postgres patch upgrade available

## Final recommendation (current)

**GO / Deploy with caution**

Rationale:

- Tenant-isolation hardening and the original member creation RLS failure class are now remediated in both repo migrations and live database.
- No remaining 2-arg `check_user_role_simple` usage was detected in `public` SECURITY DEFINER functions after this pass.
- Remaining risk is platform/security hygiene (advisor warnings), not a known cross-tenant authorization flaw in app logic.

