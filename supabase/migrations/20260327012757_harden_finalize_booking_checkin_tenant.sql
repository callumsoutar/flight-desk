-- Harden finalize_booking_checkin_with_invoice_atomic: scope staff check to the booking's
-- tenant (3-arg check_user_role_simple) and require invoice + aircraft tenant_id to match.
-- Remote history: applied as migration version 20260327012757 / name harden_finalize_booking_checkin_tenant.

CREATE OR REPLACE FUNCTION public.finalize_booking_checkin_with_invoice_atomic(
  p_booking_id uuid,
  p_invoice_id uuid,
  p_checked_out_aircraft_id uuid,
  p_checked_out_instructor_id uuid,
  p_flight_type_id uuid,
  p_hobbs_start numeric,
  p_hobbs_end numeric,
  p_tach_start numeric,
  p_tach_end numeric,
  p_airswitch_start numeric,
  p_airswitch_end numeric,
  p_solo_end_hobbs numeric,
  p_solo_end_tach numeric,
  p_dual_time numeric,
  p_solo_time numeric,
  p_billing_basis text,
  p_billing_hours numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid;
  v_booking record;
  v_aircraft record;
  v_invoice record;
  v_tenant_id uuid;
  v_hobbs_delta numeric;
  v_tach_delta numeric;
  v_airswitch_delta numeric;
  v_method text;
  v_applied_delta numeric;
  v_old_ttis numeric;
  v_new_ttis numeric;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized', 'message', 'Authentication required');
    END IF;

    SELECT
      b.id,
      b.user_id,
      b.booking_type,
      b.status,
      b.checkin_approved_at,
      b.checked_in_at,
      b.tenant_id
    INTO v_booking
    FROM public.bookings b
    WHERE b.id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Booking not found');
    END IF;

    v_tenant_id := v_booking.tenant_id;

    IF NOT public.user_belongs_to_tenant(v_tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Access denied');
    END IF;

    IF NOT public.check_user_role_simple(
      v_actor,
      v_tenant_id,
      ARRAY[
        'admin'::public.user_role,
        'owner'::public.user_role,
        'instructor'::public.user_role
      ]
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to finalize check-in');
    END IF;

    IF v_booking.booking_type IS DISTINCT FROM 'flight' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid booking type', 'message', 'Check-in finalization is only valid for flight bookings');
    END IF;
    IF v_booking.status = 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status', 'message', 'Cannot finalize check-in for cancelled bookings');
    END IF;
    IF v_booking.checkin_approved_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already approved', 'message', 'Booking check-in has already been approved');
    END IF;

    SELECT i.id, i.status, i.user_id, i.booking_id, i.tenant_id
    INTO v_invoice
    FROM public.invoices i
    WHERE i.id = p_invoice_id AND i.deleted_at IS NULL;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice not found', 'message', 'The specified invoice does not exist or has been deleted');
    END IF;

    IF v_invoice.tenant_id IS DISTINCT FROM v_tenant_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Invoice does not belong to this booking tenant');
    END IF;

    IF v_invoice.status <> 'draft' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid invoice status', 'message', 'Invoice must be in draft status');
    END IF;
    IF v_invoice.user_id <> v_booking.user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'User mismatch', 'message', 'Invoice user does not match booking user');
    END IF;
    IF v_invoice.booking_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already linked', 'message', 'Invoice is already linked to another booking');
    END IF;

    IF p_billing_basis IS NULL OR p_billing_basis NOT IN ('hobbs', 'tacho', 'airswitch') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid billing_basis', 'message', 'billing_basis must be one of hobbs, tacho, airswitch');
    END IF;
    IF p_billing_hours IS NULL OR p_billing_hours <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid billing_hours', 'message', 'billing_hours must be greater than zero');
    END IF;

    SELECT a.id, a.total_time_method, a.total_time_in_service, a.tenant_id
    INTO v_aircraft
    FROM public.aircraft a
    WHERE a.id = p_checked_out_aircraft_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Aircraft not found');
    END IF;

    IF v_aircraft.tenant_id IS DISTINCT FROM v_tenant_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Aircraft does not belong to this booking tenant');
    END IF;

    v_method := v_aircraft.total_time_method;
    IF v_method IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid aircraft total_time_method', 'message', 'Aircraft total_time_method must be set');
    END IF;

    v_hobbs_delta := CASE WHEN p_hobbs_start IS NULL OR p_hobbs_end IS NULL THEN NULL ELSE p_hobbs_end - p_hobbs_start END;
    v_tach_delta := CASE WHEN p_tach_start IS NULL OR p_tach_end IS NULL THEN NULL ELSE p_tach_end - p_tach_start END;
    v_airswitch_delta := CASE WHEN p_airswitch_start IS NULL OR p_airswitch_end IS NULL THEN NULL ELSE p_airswitch_end - p_airswitch_start END;

    IF v_hobbs_delta IS NOT NULL AND v_hobbs_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid hobbs delta');
    END IF;
    IF v_tach_delta IS NOT NULL AND v_tach_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid tach delta');
    END IF;
    IF v_airswitch_delta IS NOT NULL AND v_airswitch_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid airswitch delta');
    END IF;

    v_applied_delta := public.calculate_applied_aircraft_delta(v_method, v_hobbs_delta, v_tach_delta);
    v_old_ttis := v_aircraft.total_time_in_service;
    v_new_ttis := v_old_ttis + v_applied_delta;
    IF v_applied_delta IS NULL OR v_applied_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid applied delta');
    END IF;

    PERFORM pg_catalog.set_config('app.bypass_aircraft_total_check', 'true', true);
    UPDATE public.aircraft
    SET total_time_in_service = v_new_ttis,
        current_hobbs = COALESCE(p_hobbs_end, current_hobbs),
        current_tach = COALESCE(p_tach_end, current_tach)
    WHERE id = p_checked_out_aircraft_id;

    UPDATE public.bookings
    SET status = 'complete',
        checked_out_aircraft_id = p_checked_out_aircraft_id,
        checked_out_instructor_id = p_checked_out_instructor_id,
        flight_type_id = p_flight_type_id,
        hobbs_start = p_hobbs_start,
        hobbs_end = p_hobbs_end,
        tach_start = p_tach_start,
        tach_end = p_tach_end,
        airswitch_start = p_airswitch_start,
        airswitch_end = p_airswitch_end,
        solo_end_hobbs = p_solo_end_hobbs,
        solo_end_tach = p_solo_end_tach,
        dual_time = p_dual_time,
        solo_time = p_solo_time,
        flight_time_hobbs = v_hobbs_delta,
        flight_time_tach = v_tach_delta,
        flight_time_airswitch = v_airswitch_delta,
        billing_basis = p_billing_basis,
        billing_hours = p_billing_hours,
        total_hours_start = v_old_ttis,
        total_hours_end = v_new_ttis,
        applied_aircraft_delta = v_applied_delta,
        applied_total_time_method = v_method,
        checkin_invoice_id = p_invoice_id,
        checkin_approved_at = now(),
        checkin_approved_by = v_actor,
        checked_in_at = COALESCE(v_booking.checked_in_at, now())
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'invoice_id', p_invoice_id,
      'applied_aircraft_delta', v_applied_delta,
      'total_hours_start', v_old_ttis,
      'total_hours_end', v_new_ttis,
      'message', 'Booking check-in finalized and TTIS updated atomically'
    );

  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE,
      'message', 'Atomic check-in finalization rolled back'
    );
  END;
END;
$function$;
