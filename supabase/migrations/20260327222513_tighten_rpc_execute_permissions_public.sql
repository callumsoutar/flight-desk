DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'approve_booking_checkin_atomic',
        'cancel_booking',
        'correct_booking_checkin_ttis_atomic',
        'create_invoice_atomic',
        'record_invoice_payment_atomic',
        'record_member_credit_payment_atomic',
        'reverse_invoice_payment_atomic',
        'uncancel_booking',
        'update_invoice_status_atomic',
        'update_invoice_totals_atomic',
        'soft_delete_invoice',
        'admin_correct_invoice',
        'void_and_reissue_xero_invoice'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
  END LOOP;
END;
$$;
