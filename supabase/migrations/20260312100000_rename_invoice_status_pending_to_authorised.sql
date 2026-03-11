-- Migration: rename invoice_status 'pending' to 'authorised'
-- Aligns with Xero's AUTHORISED status for approved invoices
--
-- Part 1: Rename the enum value
ALTER TYPE public.invoice_status RENAME VALUE 'pending' TO 'authorised';

-- Part 2: Update functions that reference 'pending' to use 'authorised'

-- approve_booking_checkin_atomic: create_invoice_atomic(..., 'pending', ...) -> 'authorised'
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
  p_tax_rate numeric,
  p_due_date timestamptz,
  p_reference text,
  p_notes text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
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
    IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role]) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to approve check-in');
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

    SELECT b.id, b.user_id, b.booking_type, b.status, b.checkin_approved_at, b.checked_in_at
    INTO v_booking FROM public.bookings b WHERE b.id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Booking not found');
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

    SELECT a.id, a.total_time_method, a.total_time_in_service INTO v_aircraft FROM public.aircraft a WHERE a.id = p_checked_out_aircraft_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Aircraft not found');
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

    PERFORM set_config('app.bypass_aircraft_total_check', 'true', true);
    UPDATE public.aircraft
    SET
      total_time_in_service = v_new_ttis,
      current_hobbs = COALESCE(p_hobbs_end, current_hobbs),
      current_tach = COALESCE(p_tach_end, current_tach)
    WHERE id = p_checked_out_aircraft_id;

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
      checked_in_by = COALESCE(v_actor, v_actor)
    WHERE id = p_booking_id;

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

-- update_invoice_totals_atomic: v_invoice.status IN ('pending', 'paid') -> ('authorised', 'paid')
CREATE OR REPLACE FUNCTION public.update_invoice_totals_atomic(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice RECORD;
  v_totals RECORD;
  v_transaction_id UUID;
BEGIN
  BEGIN
    SELECT * INTO v_invoice
    FROM invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invoice not found',
        'invoice_id', p_invoice_id
      );
    END IF;

    SELECT
      COALESCE(SUM(amount), 0) as subtotal,
      COALESCE(SUM(tax_amount), 0) as tax_total,
      COALESCE(SUM(line_total), 0) as total_amount
    INTO v_totals
    FROM invoice_items
    WHERE invoice_id = p_invoice_id
      AND deleted_at IS NULL;

    PERFORM set_config('app.internal_caller', 'update_invoice_totals_atomic', true);

    UPDATE invoices
    SET
      subtotal = v_totals.subtotal,
      tax_total = v_totals.tax_total,
      total_amount = v_totals.total_amount,
      balance_due = v_totals.total_amount - total_paid,
      updated_at = NOW()
    WHERE id = p_invoice_id;

    PERFORM set_config('app.internal_caller', '', true);

    IF v_invoice.status IN ('authorised', 'paid') AND v_totals.total_amount > 0 THEN
      SELECT id INTO v_transaction_id
      FROM transactions
      WHERE invoice_id = v_invoice.id
        AND type = 'debit'
        AND status = 'completed'
        AND metadata->>'transaction_type' = 'invoice_debit';

      IF FOUND THEN
        UPDATE transactions
        SET
          amount = v_totals.total_amount,
          updated_at = NOW()
        WHERE id = v_transaction_id;
      ELSE
        INSERT INTO transactions (
          user_id, type, amount, description, metadata, status, completed_at, invoice_id
        ) VALUES (
          v_invoice.user_id,
          'debit',
          v_totals.total_amount,
          'Invoice: ' || v_invoice.invoice_number,
          jsonb_build_object(
            'invoice_id', v_invoice.id,
            'invoice_number', v_invoice.invoice_number,
            'transaction_type', 'invoice_debit'
          ),
          'completed',
          NOW(),
          v_invoice.id
        ) RETURNING id INTO v_transaction_id;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'subtotal', v_totals.subtotal,
      'tax_total', v_totals.tax_total,
      'total_amount', v_totals.total_amount,
      'transaction_id', v_transaction_id,
      'transaction_created', (v_transaction_id IS NOT NULL),
      'message', 'Invoice totals updated atomically'
    );

  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'invoice_id', p_invoice_id,
        'message', 'Invoice totals update rolled back due to error'
      );
  END;
END;
$$;

-- create_invoice_atomic: p_status IN ('draft','authorised') and update_invoice_status_atomic(..., 'authorised')
-- Note: Preserve existing signature with DEFAULTs for compatibility
CREATE OR REPLACE FUNCTION public.create_invoice_atomic(
  p_user_id uuid,
  p_booking_id uuid DEFAULT NULL::uuid,
  p_status text DEFAULT 'draft'::text,
  p_invoice_number text DEFAULT NULL::text,
  p_tax_rate numeric DEFAULT NULL::numeric,
  p_issue_date timestamptz DEFAULT now(),
  p_due_date timestamptz DEFAULT NULL::timestamptz,
  p_reference text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_invoice_id uuid;
  v_invoice_number text;
  v_issue_date timestamptz;
  v_due_date timestamptz;
  v_tax_rate numeric;
  v_total_amount numeric;
  v_totals_result jsonb;
  v_status_result jsonb;
  v_transaction_id uuid;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized', 'message', 'Authentication required');
    END IF;

    IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role]) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to create invoices');
    END IF;

    IF p_status NOT IN ('draft', 'authorised') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status', 'message', 'Only draft or authorised status is allowed at creation time');
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing invoice items', 'message', 'Invoice must include at least one item');
    END IF;

    v_issue_date := COALESCE(p_issue_date, now());
    v_due_date := COALESCE(p_due_date, v_issue_date + interval '30 days');
    v_tax_rate := COALESCE(p_tax_rate, 0.15);

    IF v_tax_rate < 0 OR v_tax_rate > 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid tax_rate', 'message', 'tax_rate must be between 0 and 1');
    END IF;

    v_invoice_number := COALESCE(p_invoice_number, generate_invoice_number_app());

    PERFORM set_config('app.internal_caller', 'create_invoice_atomic', true);

    INSERT INTO public.invoices (
      user_id, booking_id, status, invoice_number, issue_date, due_date,
      reference, notes, tax_rate, subtotal, tax_total, total_amount, total_paid, balance_due
    ) VALUES (
      p_user_id, p_booking_id, 'draft'::invoice_status, v_invoice_number,
      v_issue_date, v_due_date, p_reference, p_notes, v_tax_rate, 0, 0, 0, 0, 0
    ) RETURNING id INTO v_invoice_id;

    PERFORM set_config('app.internal_caller', '', true);

    INSERT INTO public.invoice_items (
      invoice_id, chargeable_id, description, quantity, unit_price, amount, tax_rate, tax_amount,
      rate_inclusive, line_total, notes
    )
    SELECT
      v_invoice_id, r.chargeable_id, r.description, r.quantity, r.unit_price,
      round((round((r.quantity * round((r.unit_price * (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2))::numeric, 2) / (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2) AS amount,
      COALESCE(r.tax_rate, v_tax_rate) AS tax_rate,
      round(
        round((r.quantity * round((r.unit_price * (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2))::numeric, 2) -
        round((round((r.quantity * round((r.unit_price * (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2))::numeric, 2) / (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2),
        2
      ) AS tax_amount,
      round((r.unit_price * (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2) AS rate_inclusive,
      round((r.quantity * round((r.unit_price * (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2))::numeric, 2) AS line_total,
      r.notes
    FROM jsonb_to_recordset(p_items) AS r(
      chargeable_id uuid, description text, quantity numeric, unit_price numeric, tax_rate numeric, notes text
    );

    v_totals_result := public.update_invoice_totals_atomic(v_invoice_id);
    IF (v_totals_result->>'success')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'Totals update failed: %', COALESCE(v_totals_result->>'error', 'unknown error');
    END IF;

    SELECT total_amount INTO v_total_amount FROM public.invoices WHERE id = v_invoice_id;

    IF v_total_amount IS NULL OR v_total_amount <= 0 THEN
      RAISE EXCEPTION 'Invoice total must be greater than zero';
    END IF;

    IF p_status = 'draft' THEN
      INSERT INTO public.transactions (
        user_id, type, status, amount, description, metadata, completed_at, invoice_id
      ) VALUES (
        p_user_id, 'adjustment'::transaction_type, 'completed'::transaction_status,
        v_total_amount, 'Draft invoice created: ' || v_invoice_number,
        jsonb_build_object('invoice_id', v_invoice_id, 'invoice_number', v_invoice_number, 'booking_id', p_booking_id, 'transaction_type', 'invoice_created', 'created_by', v_actor),
        now(), v_invoice_id
      ) RETURNING id INTO v_transaction_id;

      RETURN jsonb_build_object(
        'success', true, 'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number,
        'status', 'draft', 'total_amount', v_total_amount, 'transaction_id', v_transaction_id,
        'transaction_kind', 'invoice_created', 'message', 'Invoice, items, and audit transaction created atomically'
      );
    END IF;

    v_status_result := public.update_invoice_status_atomic(v_invoice_id, 'authorised');
    IF (v_status_result->>'success')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'Status update failed: %', COALESCE(v_status_result->>'error', 'unknown error');
    END IF;

    v_transaction_id := NULLIF(v_status_result->>'transaction_id', '')::uuid;

    RETURN jsonb_build_object(
      'success', true, 'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number,
      'status', 'authorised', 'total_amount', v_total_amount, 'transaction_id', v_transaction_id,
      'transaction_kind', 'invoice_debit', 'message', 'Invoice, items, totals, and debit transaction created atomically'
    );

  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', SQLSTATE, 'message', 'Atomic invoice creation rolled back due to error');
  END;
END;
$$;

-- update_invoice_status_atomic: 'pending' -> 'authorised' in all status checks
CREATE OR REPLACE FUNCTION public.update_invoice_status_atomic(
  p_invoice_id uuid,
  p_new_status text,
  p_updated_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_invoice RECORD;
  v_transaction_id UUID;
BEGIN
  BEGIN
    v_actor := auth.uid();

    IF v_actor IS NULL THEN
      IF COALESCE(current_setting('app.internal_caller', true), '') = '' THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Unauthorized',
          'message', 'Authentication required'
        );
      END IF;
    ELSE
      IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role]) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Forbidden',
          'message', 'Insufficient permissions to update invoice status'
        );
      END IF;
    END IF;

    SELECT * INTO v_invoice
    FROM invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invoice not found',
        'invoice_id', p_invoice_id
      );
    END IF;

    PERFORM set_config('app.internal_caller', 'update_invoice_status_atomic', true);

    UPDATE invoices
    SET
      status = p_new_status::invoice_status,
      updated_at = p_updated_at
    WHERE id = p_invoice_id;

    PERFORM set_config('app.internal_caller', '', true);

    IF v_invoice.status = 'draft' AND p_new_status IN ('authorised', 'paid') THEN
      INSERT INTO transactions (
        user_id, type, amount, description, metadata, status, completed_at, invoice_id
      ) VALUES (
        v_invoice.user_id,
        'debit',
        v_invoice.total_amount,
        'Invoice: ' || v_invoice.invoice_number,
        jsonb_build_object(
          'invoice_id', v_invoice.id,
          'invoice_number', v_invoice.invoice_number,
          'transaction_type', 'invoice_debit'
        ),
        'completed',
        NOW(),
        v_invoice.id
      ) RETURNING id INTO v_transaction_id;

    ELSIF v_invoice.status IN ('authorised', 'paid') AND p_new_status = 'cancelled' THEN
      SELECT id INTO v_transaction_id
      FROM transactions
      WHERE user_id = v_invoice.user_id
        AND type = 'debit'
        AND status = 'completed'
        AND metadata->>'invoice_id' = v_invoice.id::text
        AND metadata->>'transaction_type' = 'invoice_debit';

      IF FOUND THEN
        INSERT INTO transactions (
          user_id, type, amount, description, metadata, status, completed_at, invoice_id
        ) VALUES (
          v_invoice.user_id,
          'credit',
          v_invoice.total_amount,
          'Reversal of Invoice: ' || v_invoice.invoice_number || ' (cancelled)',
          jsonb_build_object(
            'reversal_of', v_transaction_id,
            'reversal_reason', 'Invoice cancelled',
            'transaction_type', 'reversal',
            'original_transaction_type', 'debit',
            'invoice_id', v_invoice.id,
            'invoice_number', v_invoice.invoice_number
          ),
          'completed',
          NOW(),
          v_invoice.id
        ) RETURNING id INTO v_transaction_id;
      END IF;

    ELSIF v_invoice.status = 'cancelled' AND p_new_status IN ('authorised', 'paid') THEN
      INSERT INTO transactions (
        user_id, type, amount, description, metadata, status, completed_at, invoice_id
      ) VALUES (
        v_invoice.user_id,
        'debit',
        v_invoice.total_amount,
        'Invoice: ' || v_invoice.invoice_number,
        jsonb_build_object(
          'invoice_id', v_invoice.id,
          'invoice_number', v_invoice.invoice_number,
          'transaction_type', 'invoice_debit'
        ),
        'completed',
        NOW(),
        v_invoice.id
      ) RETURNING id INTO v_transaction_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'old_status', v_invoice.status,
      'new_status', p_new_status,
      'transaction_id', v_transaction_id,
      'message', 'Invoice status updated atomically'
    );

  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'invoice_id', p_invoice_id,
        'message', 'Transaction rolled back due to error'
      );
  END;
END;
$$;

-- prevent_approved_invoice_modification: OLD.status IN ('pending',...) -> ('authorised',...)
CREATE OR REPLACE FUNCTION public.prevent_approved_invoice_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    PERFORM set_config('app.internal_caller', '', true);
    RETURN NEW;
  END IF;

  v_is_admin := check_user_role_simple(auth.uid(), ARRAY['admin'::user_role, 'owner'::user_role]);
  v_is_xero_locked := invoice_is_xero_exported(OLD.id);

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
    INSERT INTO admin_override_audit
      (table_name, record_id, changed_by, reason, old_data, new_data)
    VALUES
      (TG_TABLE_NAME, NEW.id, auth.uid(), v_reason, to_jsonb(OLD), to_jsonb(NEW));
    PERFORM set_config('app.override_reason', '', true);
    NEW.updated_at := NOW();
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
        INSERT INTO admin_override_audit
          (table_name, record_id, changed_by, reason, old_data, new_data)
        VALUES
          (TG_TABLE_NAME, NEW.id, auth.uid(), v_reason, to_jsonb(OLD), to_jsonb(NEW));
        PERFORM set_config('app.override_reason', '', true);
      END IF;
    END IF;
    NEW.updated_at := NOW();
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
$$;

-- prevent_approved_invoice_item_modification: v_invoice_status IN ('pending',...) -> ('authorised',...)
CREATE OR REPLACE FUNCTION public.prevent_approved_invoice_item_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_internal_caller text;
  v_invoice_status text;
  v_invoice_number text;
  v_invoice_id uuid;
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
    PERFORM set_config('app.internal_caller', '', true);
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  v_is_admin := check_user_role_simple(auth.uid(), ARRAY['admin'::user_role, 'owner'::user_role]);

  SELECT status, invoice_number INTO v_invoice_status, v_invoice_number
  FROM invoices WHERE id = v_invoice_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_is_xero_locked := invoice_is_xero_exported(v_invoice_id);

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
    INSERT INTO admin_override_audit
      (table_name, record_id, changed_by, reason, old_data, new_data)
    VALUES
      ('invoice_items', COALESCE(NEW.id, OLD.id), auth.uid(), v_reason, to_jsonb(OLD), to_jsonb(NEW));
    PERFORM set_config('app.override_reason', '', true);
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_is_admin THEN
    IF v_invoice_status IN ('authorised', 'paid', 'overdue') THEN
      v_reason := current_setting('app.override_reason', true);
      IF v_reason IS NOT NULL AND trim(v_reason) <> '' THEN
        INSERT INTO admin_override_audit
          (table_name, record_id, changed_by, reason, old_data, new_data)
        VALUES
          ('invoice_items', COALESCE(NEW.id, OLD.id), auth.uid(), v_reason, to_jsonb(OLD), to_jsonb(NEW));
        PERFORM set_config('app.override_reason', '', true);
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

-- reverse_invoice_payment_atomic: 'pending'::invoice_status -> 'authorised'::invoice_status
CREATE OR REPLACE FUNCTION public.reverse_invoice_payment_atomic(
  p_payment_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_payment record;
  v_invoice record;
  v_reversal_transaction_id uuid;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role]) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Only admins can reverse payments');
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Reason required');
    END IF;

    SELECT * INTO v_payment FROM invoice_payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
    END IF;

    SELECT * INTO v_invoice FROM invoices WHERE id = v_payment.invoice_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    INSERT INTO transactions (
      user_id, type, status, amount, description, metadata, completed_at, invoice_id
    ) VALUES (
      v_payment.user_id,
      'credit'::transaction_type,
      'completed'::transaction_status,
      v_payment.amount,
      'Payment reversal: ' || COALESCE(v_invoice.invoice_number, v_payment.invoice_id::text),
      jsonb_build_object(
        'invoice_id', v_payment.invoice_id,
        'invoice_number', v_invoice.invoice_number,
        'transaction_type', 'payment_reversal',
        'original_payment_id', p_payment_id,
        'original_transaction_id', v_payment.transaction_id,
        'reversal_reason', p_reason,
        'reversed_by', v_actor
      ),
      now(),
      v_payment.invoice_id
    ) RETURNING id INTO v_reversal_transaction_id;

    PERFORM set_config('app.internal_caller', 'reverse_invoice_payment_atomic', true);

    UPDATE invoices
    SET
      total_paid = GREATEST(0, round(total_paid - v_payment.amount, 2)),
      balance_due = round(total_amount - GREATEST(0, round(total_paid - v_payment.amount, 2)), 2),
      status = CASE
        WHEN round(total_amount - GREATEST(0, round(total_paid - v_payment.amount, 2)), 2) > 0
          AND due_date < now() THEN 'overdue'::invoice_status
        WHEN round(total_amount - GREATEST(0, round(total_paid - v_payment.amount, 2)), 2) > 0
          THEN 'authorised'::invoice_status
        ELSE status
      END,
      paid_date = CASE
        WHEN round(total_amount - GREATEST(0, round(total_paid - v_payment.amount, 2)), 2) > 0
          THEN NULL
        ELSE paid_date
      END,
      updated_at = now()
    WHERE id = v_payment.invoice_id;

    PERFORM set_config('app.internal_caller', '', true);

    INSERT INTO admin_override_audit (
      table_name, record_id, changed_by, reason, old_data, new_data
    ) VALUES (
      'invoice_payments',
      p_payment_id,
      v_actor,
      'Payment reversal: ' || p_reason,
      to_jsonb(v_payment),
      jsonb_build_object('reversal_transaction_id', v_reversal_transaction_id)
    );

    RETURN jsonb_build_object(
      'success', true,
      'payment_id', p_payment_id,
      'invoice_id', v_payment.invoice_id,
      'reversal_transaction_id', v_reversal_transaction_id,
      'reversed_amount', v_payment.amount,
      'message', 'Payment reversed and invoice updated atomically'
    );

  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;
