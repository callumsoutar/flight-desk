-- Harden remaining SECURITY DEFINER functions still using tenant-agnostic role checks.

CREATE OR REPLACE FUNCTION public.approve_booking_checkin_atomic(
  p_booking_id uuid,
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
  p_billing_hours numeric,
  p_tax_rate numeric DEFAULT NULL,
  p_due_date timestamptz DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid;
  v_tenant_id uuid;
  v_booking record;
  v_aircraft record;
  v_invoice_result jsonb;
  v_invoice_id uuid;
  v_invoice_number text;
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

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing invoice items', 'message', 'Check-in approval must include at least one invoice item');
    END IF;
    IF p_billing_basis IS NULL OR p_billing_basis NOT IN ('hobbs', 'tacho', 'airswitch') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid billing_basis', 'message', 'billing_basis must be one of hobbs, tacho, airswitch');
    END IF;
    IF p_billing_hours IS NULL OR p_billing_hours <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid billing_hours', 'message', 'billing_hours must be greater than zero');
    END IF;

    SELECT b.id, b.user_id, b.booking_type, b.status, b.checkin_approved_at, b.checked_in_at, b.tenant_id
    INTO v_booking
    FROM public.bookings b
    WHERE b.id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Booking not found');
    END IF;

    v_tenant_id := v_booking.tenant_id;
    IF v_tenant_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing tenant', 'message', 'Booking has no tenant');
    END IF;

    IF NOT public.user_belongs_to_tenant(v_tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Access denied');
    END IF;

    IF NOT public.check_user_role_simple(
      v_actor,
      v_tenant_id,
      ARRAY['admin'::public.user_role, 'owner'::public.user_role, 'instructor'::public.user_role]
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to approve check-in');
    END IF;

    IF v_booking.booking_type IS DISTINCT FROM 'flight' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid booking type', 'message', 'Check-in approval is only valid for flight bookings');
    END IF;
    IF v_booking.status = 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status', 'message', 'Cannot approve check-in for cancelled bookings');
    END IF;
    IF v_booking.checkin_approved_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already approved', 'message', 'Booking check-in has already been approved');
    END IF;
    IF v_booking.user_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing booking user', 'message', 'Cannot invoice a booking without a member/user_id');
    END IF;
    IF EXISTS (SELECT 1 FROM public.invoices i WHERE i.booking_id = p_booking_id AND i.deleted_at IS NULL) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice already exists', 'message', 'An active invoice already exists for this booking');
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
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Aircraft does not belong to booking tenant');
    END IF;

    v_method := v_aircraft.total_time_method;
    IF v_method IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid aircraft total_time_method', 'message', 'Aircraft total_time_method must be set to apply TTIS deltas');
    END IF;

    v_hobbs_delta := CASE WHEN p_hobbs_start IS NULL OR p_hobbs_end IS NULL THEN NULL ELSE p_hobbs_end - p_hobbs_start END;
    v_tach_delta := CASE WHEN p_tach_start IS NULL OR p_tach_end IS NULL THEN NULL ELSE p_tach_end - p_tach_start END;
    v_airswitch_delta := CASE WHEN p_airswitch_start IS NULL OR p_airswitch_end IS NULL THEN NULL ELSE p_airswitch_end - p_airswitch_start END;

    IF v_hobbs_delta IS NOT NULL AND v_hobbs_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid hobbs delta', 'message', 'hobbs_end must be >= hobbs_start');
    END IF;
    IF v_tach_delta IS NOT NULL AND v_tach_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid tach delta', 'message', 'tach_end must be >= tach_start');
    END IF;
    IF v_airswitch_delta IS NOT NULL AND v_airswitch_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid airswitch delta', 'message', 'airswitch_end must be >= airswitch_start');
    END IF;

    v_applied_delta := public.calculate_applied_aircraft_delta(v_method, v_hobbs_delta, v_tach_delta);
    v_old_ttis := v_aircraft.total_time_in_service;
    v_new_ttis := v_old_ttis + v_applied_delta;

    IF v_applied_delta IS NULL OR v_applied_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid applied delta', 'message', 'Applied aircraft delta must be non-negative');
    END IF;

    v_invoice_result := public.create_invoice_atomic(v_booking.user_id, p_booking_id, 'authorised', NULL, p_tax_rate, now(), p_due_date, p_reference, p_notes, p_items);
    IF (v_invoice_result->>'success')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'Atomic invoice creation failed: %', COALESCE(v_invoice_result->>'error', 'unknown error');
    END IF;
    v_invoice_id := NULLIF(v_invoice_result->>'invoice_id', '')::uuid;
    v_invoice_number := v_invoice_result->>'invoice_number';
    IF v_invoice_id IS NULL THEN
      RAISE EXCEPTION 'Atomic invoice creation did not return invoice_id';
    END IF;

    PERFORM pg_catalog.set_config('app.bypass_aircraft_total_check', 'true', true);
    UPDATE public.aircraft
    SET
      total_time_in_service = v_new_ttis,
      current_hobbs = COALESCE(p_hobbs_end, current_hobbs),
      current_tach = COALESCE(p_tach_end, current_tach)
    WHERE id = p_checked_out_aircraft_id
      AND tenant_id = v_tenant_id;

    UPDATE public.bookings
    SET
      status = 'complete',
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
      checkin_invoice_id = v_invoice_id,
      checkin_approved_at = now(),
      checkin_approved_by = v_actor,
      checked_in_at = COALESCE(v_booking.checked_in_at, now()),
      checked_in_by = v_actor
    WHERE id = p_booking_id
      AND tenant_id = v_tenant_id;

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'invoice_id', v_invoice_id,
      'invoice_number', v_invoice_number,
      'applied_aircraft_delta', v_applied_delta,
      'total_hours_start', v_old_ttis,
      'total_hours_end', v_new_ttis,
      'message', 'Booking check-in approved and TTIS updated atomically'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', SQLSTATE, 'message', 'Atomic check-in approval rolled back due to error');
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.correct_booking_checkin_ttis_atomic(
  p_booking_id uuid,
  p_hobbs_end numeric,
  p_tach_end numeric,
  p_airswitch_end numeric,
  p_correction_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid;
  v_tenant_id uuid;
  v_booking record;
  v_aircraft record;
  v_new_hobbs_delta numeric;
  v_new_tach_delta numeric;
  v_new_airswitch_delta numeric;
  v_method text;
  v_old_applied_delta numeric;
  v_new_applied_delta numeric;
  v_correction_delta numeric;
  v_aircraft_old_ttis numeric;
  v_aircraft_new_ttis numeric;
  v_booking_new_total_hours_end numeric;
  v_is_most_recent_booking boolean;
  v_should_update_current_meters boolean;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized', 'message', 'Authentication required');
    END IF;

    IF p_correction_reason IS NULL OR length(trim(p_correction_reason)) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid correction_reason', 'message', 'correction_reason is required');
    END IF;

    SELECT b.id, b.tenant_id, b.booking_type, b.status, b.checkin_approved_at, b.checked_out_aircraft_id, b.end_time, b.hobbs_start, b.tach_start, b.airswitch_start, b.applied_aircraft_delta, b.applied_total_time_method, b.total_hours_end
    INTO v_booking
    FROM public.bookings b
    WHERE b.id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Booking not found');
    END IF;

    v_tenant_id := v_booking.tenant_id;
    IF v_tenant_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing tenant', 'message', 'Booking has no tenant');
    END IF;

    IF NOT public.user_belongs_to_tenant(v_tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Access denied');
    END IF;

    IF NOT public.check_user_role_simple(
      v_actor,
      v_tenant_id,
      ARRAY['admin'::public.user_role, 'owner'::public.user_role, 'instructor'::public.user_role]
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to correct check-in');
    END IF;

    IF v_booking.booking_type IS DISTINCT FROM 'flight' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid booking type', 'message', 'Corrections are only valid for flight bookings');
    END IF;
    IF v_booking.status = 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status', 'message', 'Cannot correct cancelled bookings');
    END IF;
    IF v_booking.checkin_approved_at IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not approved', 'message', 'Cannot correct an unapproved check-in');
    END IF;
    IF v_booking.checked_out_aircraft_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing aircraft', 'message', 'Booking has no checked_out_aircraft_id');
    END IF;

    v_old_applied_delta := v_booking.applied_aircraft_delta;
    IF v_old_applied_delta IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing applied delta', 'message', 'Booking is missing applied_aircraft_delta (cannot correct safely)');
    END IF;

    v_method := v_booking.applied_total_time_method;
    IF v_method IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing method snapshot', 'message', 'Booking is missing applied_total_time_method (cannot correct deterministically)');
    END IF;

    SELECT a.id, a.tenant_id, a.total_time_in_service, a.current_tach, a.current_hobbs
    INTO v_aircraft
    FROM public.aircraft a
    WHERE a.id = v_booking.checked_out_aircraft_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Aircraft not found');
    END IF;

    IF v_aircraft.tenant_id IS DISTINCT FROM v_tenant_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Aircraft does not belong to booking tenant');
    END IF;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.bookings b2
      WHERE b2.checked_out_aircraft_id = v_booking.checked_out_aircraft_id
        AND b2.status = 'complete'
        AND b2.checkin_approved_at IS NOT NULL
        AND b2.id != p_booking_id
        AND (b2.end_time > v_booking.end_time OR (b2.end_time = v_booking.end_time AND b2.checkin_approved_at > v_booking.checkin_approved_at))
    ) INTO v_is_most_recent_booking;
    v_should_update_current_meters := v_is_most_recent_booking;

    v_new_hobbs_delta := CASE WHEN v_booking.hobbs_start IS NULL OR p_hobbs_end IS NULL THEN NULL ELSE p_hobbs_end - v_booking.hobbs_start END;
    v_new_tach_delta := CASE WHEN v_booking.tach_start IS NULL OR p_tach_end IS NULL THEN NULL ELSE p_tach_end - v_booking.tach_start END;
    v_new_airswitch_delta := CASE WHEN v_booking.airswitch_start IS NULL OR p_airswitch_end IS NULL THEN NULL ELSE p_airswitch_end - v_booking.airswitch_start END;

    IF v_new_hobbs_delta IS NOT NULL AND v_new_hobbs_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid hobbs delta', 'message', 'New hobbs_end must be >= hobbs_start');
    END IF;
    IF v_new_tach_delta IS NOT NULL AND v_new_tach_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid tach delta', 'message', 'New tach_end must be >= tach_start');
    END IF;
    IF v_new_airswitch_delta IS NOT NULL AND v_new_airswitch_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid airswitch delta', 'message', 'New airswitch_end must be >= airswitch_start');
    END IF;

    v_new_applied_delta := public.calculate_applied_aircraft_delta(v_method, v_new_hobbs_delta, v_new_tach_delta);
    v_correction_delta := v_new_applied_delta - v_old_applied_delta;
    v_aircraft_old_ttis := v_aircraft.total_time_in_service;
    v_aircraft_new_ttis := v_aircraft_old_ttis + v_correction_delta;

    IF v_aircraft_new_ttis < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid correction', 'message', 'Correction would result in negative aircraft TTIS');
    END IF;

    PERFORM pg_catalog.set_config('app.bypass_aircraft_total_check', 'true', true);
    IF v_should_update_current_meters THEN
      UPDATE public.aircraft
      SET total_time_in_service = v_aircraft_new_ttis,
          current_tach = COALESCE(p_tach_end, current_tach),
          current_hobbs = COALESCE(p_hobbs_end, current_hobbs)
      WHERE id = v_booking.checked_out_aircraft_id
        AND tenant_id = v_tenant_id;
    ELSE
      UPDATE public.aircraft
      SET total_time_in_service = v_aircraft_new_ttis
      WHERE id = v_booking.checked_out_aircraft_id
        AND tenant_id = v_tenant_id;
    END IF;

    v_booking_new_total_hours_end := COALESCE(v_booking.total_hours_end, 0) + v_correction_delta;

    UPDATE public.bookings
    SET hobbs_end = p_hobbs_end,
        tach_end = p_tach_end,
        airswitch_end = p_airswitch_end,
        flight_time_hobbs = v_new_hobbs_delta,
        flight_time_tach = v_new_tach_delta,
        flight_time_airswitch = v_new_airswitch_delta,
        applied_aircraft_delta = v_new_applied_delta,
        correction_delta = v_correction_delta,
        corrected_at = now(),
        corrected_by = v_actor,
        correction_reason = p_correction_reason,
        total_hours_end = v_booking_new_total_hours_end
    WHERE id = p_booking_id
      AND tenant_id = v_tenant_id;

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'old_applied_delta', v_old_applied_delta,
      'new_applied_delta', v_new_applied_delta,
      'correction_delta', v_correction_delta,
      'aircraft_total_time_in_service', v_aircraft_new_ttis,
      'is_most_recent_booking', v_is_most_recent_booking,
      'updated_current_meters', v_should_update_current_meters,
      'message', 'Booking TTIS correction applied atomically' ||
        CASE WHEN v_should_update_current_meters
          THEN ' (current meters updated)'
          ELSE ' (current meters unchanged - not most recent booking)'
        END
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', SQLSTATE, 'message', 'Atomic TTIS correction rolled back due to error');
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_aircraft_current_meters(
  p_aircraft_id uuid,
  p_current_tach numeric DEFAULT NULL,
  p_current_hobbs numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid;
  v_aircraft record;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized', 'message', 'Authentication required');
  END IF;

  SELECT a.id, a.tenant_id, a.current_tach, a.current_hobbs
  INTO v_aircraft
  FROM public.aircraft a
  WHERE a.id = p_aircraft_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Aircraft not found');
  END IF;

  IF NOT public.user_belongs_to_tenant(v_aircraft.tenant_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Access denied');
  END IF;

  IF NOT public.check_user_role_simple(
    v_actor,
    v_aircraft.tenant_id,
    ARRAY['admin'::public.user_role, 'owner'::public.user_role]
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Only admin or owner can update aircraft current meters');
  END IF;

  IF p_current_tach IS NULL AND p_current_hobbs IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid input', 'message', 'Provide at least one of current_tach or current_hobbs');
  END IF;

  PERFORM pg_catalog.set_config('app.bypass_aircraft_total_check', 'true', true);
  PERFORM pg_catalog.set_config('app.ttis_change_source', 'manual', true);

  UPDATE public.aircraft
  SET current_tach = COALESCE(p_current_tach, current_tach),
      current_hobbs = COALESCE(p_current_hobbs, current_hobbs)
  WHERE id = p_aircraft_id
    AND tenant_id = v_aircraft.tenant_id;

  RETURN jsonb_build_object('success', true, 'aircraft_id', p_aircraft_id, 'message', 'Aircraft current meters updated');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'message', 'Update failed');
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_approved_invoice_item_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_internal_caller text;
  v_invoice_status text;
  v_invoice_number text;
  v_invoice_id uuid;
  v_tenant_id uuid;
  v_is_admin boolean;
  v_is_xero_locked boolean;
  v_reason text;
BEGIN
  v_internal_caller := COALESCE(current_setting('app.internal_caller', true), '');
  IF v_internal_caller = ANY(ARRAY[
    'update_invoice_totals_atomic',
    'create_invoice_atomic',
    'void_and_reissue_xero_invoice',
    'admin_correct_invoice'
  ]) THEN
    PERFORM pg_catalog.set_config('app.internal_caller', '', true);
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT i.status, i.invoice_number, i.tenant_id
  INTO v_invoice_status, v_invoice_number, v_tenant_id
  FROM public.invoices i
  WHERE i.id = v_invoice_id
    AND i.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_is_admin := public.check_user_role_simple(auth.uid(), v_tenant_id, ARRAY['admin'::public.user_role, 'owner'::public.user_role]);
  v_is_xero_locked := public.invoice_is_xero_exported(v_invoice_id);

  IF v_is_xero_locked THEN
    IF current_setting('app.xero_resync_acknowledged', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Cannot modify items on Xero-exported invoice %. Initiate a void-and-reissue workflow.', v_invoice_number
        USING ERRCODE = 'P0001';
    END IF;
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Only admins can modify items on Xero-exported invoices during resync.'
        USING ERRCODE = 'P0001';
    END IF;
    v_reason := current_setting('app.override_reason', true);
    IF v_reason IS NULL OR trim(v_reason) = '' THEN
      RAISE EXCEPTION 'Admin overrides on Xero-exported invoice items require app.override_reason'
        USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.admin_override_audit
      (table_name, record_id, changed_by, reason, old_data, new_data)
    VALUES
      ('invoice_items', COALESCE(NEW.id, OLD.id), auth.uid(), v_reason, to_jsonb(OLD), to_jsonb(NEW));
    PERFORM pg_catalog.set_config('app.override_reason', '', true);
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_is_admin THEN
    IF v_invoice_status IN ('authorised', 'paid', 'overdue') THEN
      v_reason := current_setting('app.override_reason', true);
      IF v_reason IS NOT NULL AND trim(v_reason) <> '' THEN
        INSERT INTO public.admin_override_audit
          (table_name, record_id, changed_by, reason, old_data, new_data)
        VALUES
          ('invoice_items', COALESCE(NEW.id, OLD.id), auth.uid(), v_reason, to_jsonb(OLD), to_jsonb(NEW));
        PERFORM pg_catalog.set_config('app.override_reason', '', true);
      END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_invoice_status IN ('authorised', 'paid', 'overdue') THEN
    IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Cannot add items to approved invoice %. Contact an admin.', v_invoice_number
        USING ERRCODE = 'P0001';
    ELSIF TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'Cannot modify items on approved invoice %. Contact an admin.', v_invoice_number
        USING ERRCODE = 'P0001';
    ELSIF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete items from approved invoice %. Contact an admin.', v_invoice_number
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_approved_invoice_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_internal_caller text;
  v_is_admin boolean;
  v_reason text;
  v_is_xero_locked boolean;
BEGIN
  v_internal_caller := COALESCE(current_setting('app.internal_caller', true), '');
  IF v_internal_caller = ANY(ARRAY[
    'update_invoice_totals_atomic',
    'record_invoice_payment_atomic',
    'update_invoice_status_atomic',
    'create_invoice_atomic',
    'void_and_reissue_xero_invoice',
    'admin_correct_invoice',
    'reverse_invoice_payment_atomic'
  ]) THEN
    PERFORM pg_catalog.set_config('app.internal_caller', '', true);
    RETURN NEW;
  END IF;

  v_is_admin := public.check_user_role_simple(auth.uid(), OLD.tenant_id, ARRAY['admin'::public.user_role, 'owner'::public.user_role]);
  v_is_xero_locked := public.invoice_is_xero_exported(OLD.id);

  IF v_is_xero_locked THEN
    IF current_setting('app.xero_resync_acknowledged', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Invoice % has been exported to Xero and is locked. Initiate a void-and-reissue workflow to make changes.', OLD.invoice_number
        USING ERRCODE = 'P0001';
    END IF;
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Only admins can modify Xero-exported invoices during resync.'
        USING ERRCODE = 'P0001';
    END IF;
    v_reason := current_setting('app.override_reason', true);
    IF v_reason IS NULL OR trim(v_reason) = '' THEN
      RAISE EXCEPTION 'Admin overrides on Xero-exported invoices require app.override_reason to be set'
        USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.admin_override_audit
      (table_name, record_id, changed_by, reason, old_data, new_data)
    VALUES
      (TG_TABLE_NAME, NEW.id, auth.uid(), v_reason, to_jsonb(OLD), to_jsonb(NEW));
    PERFORM pg_catalog.set_config('app.override_reason', '', true);
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF v_is_admin THEN
    IF OLD.status IN ('authorised', 'paid', 'overdue') THEN
      IF (NEW.subtotal IS DISTINCT FROM OLD.subtotal) OR
         (NEW.tax_total IS DISTINCT FROM OLD.tax_total) OR
         (NEW.total_amount IS DISTINCT FROM OLD.total_amount) OR
         (NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
        v_reason := current_setting('app.override_reason', true);
        IF v_reason IS NULL OR trim(v_reason) = '' THEN
          RAISE EXCEPTION 'Admin overrides of financial fields require app.override_reason to be set'
            USING ERRCODE = 'P0001';
        END IF;
        INSERT INTO public.admin_override_audit
          (table_name, record_id, changed_by, reason, old_data, new_data)
        VALUES
          (TG_TABLE_NAME, NEW.id, auth.uid(), v_reason, to_jsonb(OLD), to_jsonb(NEW));
        PERFORM pg_catalog.set_config('app.override_reason', '', true);
      END IF;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF OLD.status IN ('authorised', 'paid', 'overdue') THEN
    IF (NEW.status IS DISTINCT FROM OLD.status) OR
       (NEW.total_paid IS DISTINCT FROM OLD.total_paid) OR
       (NEW.paid_date IS DISTINCT FROM OLD.paid_date) OR
       (NEW.balance_due IS DISTINCT FROM OLD.balance_due) OR
       (NEW.updated_at IS DISTINCT FROM OLD.updated_at) OR
       (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) OR
       (NEW.deleted_by IS DISTINCT FROM OLD.deleted_by) OR
       (NEW.deletion_reason IS DISTINCT FROM OLD.deletion_reason) THEN

      IF (NEW.subtotal IS DISTINCT FROM OLD.subtotal) OR
         (NEW.tax_total IS DISTINCT FROM OLD.tax_total) OR
         (NEW.total_amount IS DISTINCT FROM OLD.total_amount) THEN
        RAISE EXCEPTION 'Cannot modify financial totals of approved invoice %. Contact an admin.', OLD.invoice_number
          USING ERRCODE = 'P0001';
      END IF;

      IF (NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
        RAISE EXCEPTION 'Cannot change customer of approved invoice %', OLD.invoice_number
          USING ERRCODE = 'P0001';
      END IF;

      IF (NEW.issue_date IS DISTINCT FROM OLD.issue_date) THEN
        RAISE EXCEPTION 'Cannot change issue date of approved invoice %', OLD.invoice_number
          USING ERRCODE = 'P0001';
      END IF;

      RETURN NEW;
    END IF;

    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Cannot modify approved invoice %. Contact an admin.', OLD.invoice_number
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;"}}}
