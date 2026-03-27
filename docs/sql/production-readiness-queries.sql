-- Production / pre-launch checks: run via Supabase SQL editor or Supabase MCP `execute_sql`.
-- Pair with docs/production-readiness-audit.md (bookings RLS, DEFINER RPCs, JWT hook).
--
-- Supabase MCP (also useful):
--   list_migrations(project_id)     — compare to supabase/migrations/
--   get_advisors(project_id, "security")

-- A) Bookings RLS
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'bookings'
order by cmd, policyname;

-- B) check_user_role_simple overloads (expect 2-arg + 3-arg; review callers of 2-arg in DEFINER RPCs)
select p.oid::regprocedure as signature, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'check_user_role_simple'
order by 1;

-- C) Critical DEFINER bodies (spot-check tenant alignment after deploys)
select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'finalize_booking_checkin_with_invoice_atomic',
    'uncancel_booking',
    'record_invoice_payment_atomic'
  )
order by 1;

-- D) Custom access token hook exists (Dashboard must still enable Auth → Hooks → this function)
select p.oid::regprocedure
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'flightdesk_access_token_hook';
