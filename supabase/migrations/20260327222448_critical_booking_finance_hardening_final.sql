DROP POLICY IF EXISTS bookings_tenant_update ON public.bookings;
CREATE POLICY bookings_tenant_update
ON public.bookings
FOR UPDATE
TO public
USING (
  public.user_belongs_to_tenant(tenant_id)
)
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    (SELECT auth.uid()),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid,
  p_cancellation_category_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid;
  v_booking_id uuid;
  v_booking_user_id uuid;
  v_current_status public.booking_status;
  v_tenant_id uuid;
  v_is_staff boolean;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT b.id, b.user_id, b.status, b.tenant_id
  INTO v_booking_id, v_booking_user_id, v_current_status, v_tenant_id
  FROM public.bookings b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF NOT public.user_belongs_to_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_is_staff := public.check_user_role_simple(
    v_actor,
    v_tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  );

  IF NOT v_is_staff AND v_actor IS DISTINCT FROM v_booking_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_current_status = 'cancelled'::public.booking_status THEN
    RAISE EXCEPTION 'Booking is already cancelled';
  END IF;

  IF v_current_status = 'complete'::public.booking_status THEN
    RAISE EXCEPTION 'Cannot cancel completed booking';
  END IF;

  UPDATE public.bookings
  SET
    status = 'cancelled'::public.booking_status,
    cancellation_category_id = p_cancellation_category_id,
    cancellation_reason = p_reason,
    cancelled_by = v_actor,
    cancelled_notes = p_notes,
    cancelled_at = now(),
    updated_at = now()
  WHERE id = p_booking_id
    AND tenant_id = v_tenant_id;

  RETURN p_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_invoice_payment_atomic(
  p_payment_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid;
  v_tenant_id uuid;
  v_payment record;
  v_invoice record;
  v_reversal_transaction_id uuid;
  v_existing_reversal_id uuid;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Reason required');
    END IF;

    SELECT *
    INTO v_payment
    FROM public.invoice_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
    END IF;

    SELECT *
    INTO v_invoice
    FROM public.invoices
    WHERE id = v_payment.invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    v_tenant_id := COALESCE(v_invoice.tenant_id, v_payment.tenant_id);
    IF v_tenant_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Tenant missing');
    END IF;

    IF NOT public.user_belongs_to_tenant(v_tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Access denied');
    END IF;

    IF NOT public.check_user_role_simple(
      v_actor,
      v_tenant_id,
      ARRAY['admin'::public.user_role, 'owner'::public.user_role]
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Only admins can reverse payments');
    END IF;

    SELECT t.id
    INTO v_existing_reversal_id
    FROM public.transactions t
    WHERE t.tenant_id = v_tenant_id
      AND t.status = 'completed'::public.transaction_status
      AND t.metadata->>'transaction_type' = 'payment_reversal'
      AND t.metadata->>'original_payment_id' = p_payment_id::text
    LIMIT 1;

    IF v_existing_reversal_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Already reversed',
        'message', 'This payment has already been reversed',
        'reversal_transaction_id', v_existing_reversal_id
      );
    END IF;

    INSERT INTO public.transactions (
      user_id, tenant_id, type, status, amount, description, metadata, completed_at, invoice_id
    ) VALUES (
      v_payment.user_id,
      v_tenant_id,
      'credit'::public.transaction_type,
      'completed'::public.transaction_status,
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

    PERFORM pg_catalog.set_config('app.internal_caller', 'reverse_invoice_payment_atomic', true);

    UPDATE public.invoices
    SET
      total_paid = GREATEST(0, round(total_paid - v_payment.amount, 2)),
      balance_due = round(total_amount - GREATEST(0, round(total_paid - v_payment.amount, 2)), 2),
      status = CASE
        WHEN round(total_amount - GREATEST(0, round(total_paid - v_payment.amount, 2)), 2) > 0
          AND due_date < now() THEN 'overdue'::public.invoice_status
        WHEN round(total_amount - GREATEST(0, round(total_paid - v_payment.amount, 2)), 2) > 0
          THEN 'authorised'::public.invoice_status
        ELSE status
      END,
      paid_date = CASE
        WHEN round(total_amount - GREATEST(0, round(total_paid - v_payment.amount, 2)), 2) > 0
          THEN NULL
        ELSE paid_date
      END,
      updated_at = now()
    WHERE id = v_payment.invoice_id
      AND tenant_id = v_tenant_id;

    PERFORM pg_catalog.set_config('app.internal_caller', '', true);

    INSERT INTO public.admin_override_audit (
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
      PERFORM pg_catalog.set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_invoice_totals_atomic(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid;
  v_internal_caller text;
  v_invoice record;
  v_totals record;
  v_transaction_id uuid;
BEGIN
  BEGIN
    v_actor := auth.uid();
    v_internal_caller := COALESCE(current_setting('app.internal_caller', true), '');

    IF v_actor IS NULL AND v_internal_caller = '' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Unauthorized',
        'message', 'Authentication required'
      );
    END IF;

    SELECT *
    INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invoice not found',
        'invoice_id', p_invoice_id
      );
    END IF;

    IF v_internal_caller = '' THEN
      IF v_actor IS NULL OR NOT public.user_belongs_to_tenant(v_invoice.tenant_id) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Forbidden',
          'message', 'Access denied'
        );
      END IF;

      IF NOT public.check_user_role_simple(
        v_actor,
        v_invoice.tenant_id,
        ARRAY['admin'::public.user_role, 'owner'::public.user_role, 'instructor'::public.user_role]
      ) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Forbidden',
          'message', 'Insufficient permissions to update invoice totals'
        );
      END IF;
    END IF;

    SELECT
      COALESCE(SUM(ii.amount), 0) AS subtotal,
      COALESCE(SUM(ii.tax_amount), 0) AS tax_total,
      COALESCE(SUM(ii.line_total), 0) AS total_amount
    INTO v_totals
    FROM public.invoice_items ii
    WHERE ii.invoice_id = p_invoice_id
      AND ii.deleted_at IS NULL;

    PERFORM pg_catalog.set_config('app.internal_caller', 'update_invoice_totals_atomic', true);

    UPDATE public.invoices
    SET
      subtotal = v_totals.subtotal,
      tax_total = v_totals.tax_total,
      total_amount = v_totals.total_amount,
      balance_due = round(v_totals.total_amount - total_paid, 2),
      updated_at = now()
    WHERE id = p_invoice_id
      AND tenant_id = v_invoice.tenant_id;

    PERFORM pg_catalog.set_config('app.internal_caller', '', true);

    IF v_invoice.status IN ('authorised', 'paid') AND v_totals.total_amount > 0 THEN
      SELECT t.id
      INTO v_transaction_id
      FROM public.transactions t
      WHERE t.invoice_id = v_invoice.id
        AND t.tenant_id = v_invoice.tenant_id
        AND t.type = 'debit'::public.transaction_type
        AND t.status = 'completed'::public.transaction_status
        AND t.metadata->>'transaction_type' = 'invoice_debit'
      LIMIT 1;

      IF v_transaction_id IS NOT NULL THEN
        UPDATE public.transactions
        SET
          amount = v_totals.total_amount,
          updated_at = now()
        WHERE id = v_transaction_id
          AND tenant_id = v_invoice.tenant_id;
      ELSE
        INSERT INTO public.transactions (
          user_id, tenant_id, type, amount, description, metadata, status, completed_at, invoice_id
        ) VALUES (
          v_invoice.user_id,
          v_invoice.tenant_id,
          'debit'::public.transaction_type,
          v_totals.total_amount,
          'Invoice: ' || v_invoice.invoice_number,
          jsonb_build_object(
            'invoice_id', v_invoice.id,
            'invoice_number', v_invoice.invoice_number,
            'transaction_type', 'invoice_debit'
          ),
          'completed'::public.transaction_status,
          now(),
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
      PERFORM pg_catalog.set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'invoice_id', p_invoice_id,
        'message', 'Invoice totals update rolled back due to error'
      );
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_invoice(
  p_invoice_id uuid,
  p_user_id uuid,
  p_reason text DEFAULT 'User initiated deletion'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid;
  v_invoice record;
  v_transaction_count int;
  v_items_deleted int;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized',
      'message', 'Authentication required'
    );
  END IF;

  SELECT *
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invoice not found',
      'invoice_id', p_invoice_id
    );
  END IF;

  IF v_invoice.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invoice is already deleted',
      'invoice_number', v_invoice.invoice_number,
      'deleted_at', v_invoice.deleted_at
    );
  END IF;

  IF NOT public.user_belongs_to_tenant(v_invoice.tenant_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Forbidden',
      'message', 'Access denied'
    );
  END IF;

  IF NOT public.check_user_role_simple(
    v_actor,
    v_invoice.tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Forbidden',
      'message', 'Insufficient permissions to delete invoice'
    );
  END IF;

  IF v_invoice.status != 'draft'::public.invoice_status THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete approved invoice. Create a credit note instead.',
      'invoice_number', v_invoice.invoice_number,
      'status', v_invoice.status,
      'hint', 'Only draft invoices can be deleted. Use credit notes for corrections on approved invoices.'
    );
  END IF;

  SELECT COUNT(*)
  INTO v_transaction_count
  FROM public.transactions t
  WHERE t.invoice_id = p_invoice_id
    AND t.tenant_id = v_invoice.tenant_id
    AND t.deleted_at IS NULL;

  IF v_transaction_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invoice has associated transactions and cannot be deleted',
      'transaction_count', v_transaction_count,
      'invoice_number', v_invoice.invoice_number
    );
  END IF;

  UPDATE public.invoices
  SET
    deleted_at = now(),
    deleted_by = v_actor,
    deletion_reason = p_reason,
    updated_at = now()
  WHERE id = p_invoice_id
    AND tenant_id = v_invoice.tenant_id;

  UPDATE public.invoice_items
  SET
    deleted_at = now(),
    deleted_by = v_actor,
    updated_at = now()
  WHERE invoice_id = p_invoice_id
    AND tenant_id = v_invoice.tenant_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_items_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'invoice_number', v_invoice.invoice_number,
    'items_deleted', v_items_deleted,
    'deleted_at', now(),
    'deleted_by', v_actor,
    'reason', p_reason,
    'message', 'Invoice and all associated items have been soft deleted'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'invoice_id', p_invoice_id,
      'message', 'An error occurred during soft delete'
    );
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
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
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', r.proname, r.args);
  END LOOP;
END;
$$;
