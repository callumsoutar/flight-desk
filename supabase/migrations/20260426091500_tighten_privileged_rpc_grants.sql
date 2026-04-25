-- Tighten exposed RPC surface for privileged booking and finance functions.
-- This migration changes only EXECUTE grants; it does not alter schemas, RLS policies, or function bodies.

-- App-called privileged RPCs: signed-in users may execute, anonymous/public callers may not.
REVOKE EXECUTE ON FUNCTION public.approve_booking_checkin_atomic(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  timestamp with time zone,
  text,
  jsonb
) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_booking_checkin_atomic(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  timestamp with time zone,
  text,
  jsonb
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_invoice_atomic(
  uuid,
  uuid,
  text,
  text,
  numeric,
  timestamp with time zone,
  timestamp with time zone,
  text,
  jsonb
) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invoice_atomic(
  uuid,
  uuid,
  text,
  text,
  numeric,
  timestamp with time zone,
  timestamp with time zone,
  text,
  jsonb
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.finalize_booking_checkin_with_invoice_atomic(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  numeric
) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_booking_checkin_with_invoice_atomic(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  numeric
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.void_invoice_atomic(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_invoice_atomic(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_financial_daily_summary_report(
  timestamp with time zone,
  timestamp with time zone
) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_daily_summary_report(
  timestamp with time zone,
  timestamp with time zone
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_financial_transaction_list_report(
  timestamp with time zone,
  timestamp with time zone,
  integer,
  integer
) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_transaction_list_report(
  timestamp with time zone,
  timestamp with time zone,
  integer,
  integer
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.invoice_is_xero_exported(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoice_is_xero_exported(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_aircraft_current_meters(
  uuid,
  numeric,
  numeric
) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_aircraft_current_meters(
  uuid,
  numeric,
  numeric
) TO authenticated;

-- Internal invoice-number helpers are called from server-side database code, not directly by clients.
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number_app() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number_with_prefix(text) FROM anon, authenticated, PUBLIC;

-- Trigger-only functions should not be directly executable by API clients.
REVOKE EXECUTE ON FUNCTION public.check_invoice_totals_consistent() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_booking_delete_ttis_reversal() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_booking_audit_improved() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_tenant_settings_audit() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_approved_invoice_item_modification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_approved_invoice_modification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_invoice_payment_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_payment_on_paid_invoice() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_xero_invoice_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_invoice_on_item_soft_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_tenant_settings_updated_at() FROM anon, authenticated, PUBLIC;
