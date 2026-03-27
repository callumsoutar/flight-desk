-- Harden finance/admin SECURITY DEFINER functions to tenant-scoped role checks.

CREATE OR REPLACE FUNCTION public.admin_correct_invoice(
  p_invoice_id uuid,
  p_changes jsonb,
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
  v_invoice record;
  v_computed_subtotal numeric;
  v_computed_tax_total numeric;
  v_computed_total numeric;
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
    INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    v_tenant_id := v_invoice.tenant_id;
    IF v_tenant_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice tenant missing');
    END IF;

    IF NOT public.user_belongs_to_tenant(v_tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
    END IF;

    IF NOT public.check_user_role_simple(
      v_actor,
      v_tenant_id,
      ARRAY['admin'::public.user_role, 'owner'::public.user_role]
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
    END IF;

    SELECT
      COALESCE(SUM(amount), 0),
      COALESCE(SUM(tax_amount), 0),
      COALESCE(SUM(line_total), 0)
    INTO v_computed_subtotal, v_computed_tax_total, v_computed_total
    FROM public.invoice_items
    WHERE invoice_id = p_invoice_id
      AND deleted_at IS NULL;

    IF p_changes ? 'subtotal' OR p_changes ? 'tax_total' OR p_changes ? 'total_amount' THEN
      IF round(COALESCE((p_changes->>'subtotal')::numeric, v_computed_subtotal), 2) <> round(v_computed_subtotal, 2) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Subtotal mismatch',
          'message', 'Provided subtotal does not match sum of active items',
          'computed', v_computed_subtotal
        );
      END IF;
    END IF;

    PERFORM pg_catalog.set_config('app.override_reason', p_reason, true);
    PERFORM pg_catalog.set_config('app.internal_caller', 'admin_correct_invoice', true);
    PERFORM public.update_invoice_totals_atomic(p_invoice_id);
    PERFORM pg_catalog.set_config('app.internal_caller', '', true);
    PERFORM pg_catalog.set_config('app.override_reason', '', true);

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'reason', p_reason,
      'message', 'Invoice corrected and audit logged'
    );

  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_catalog.set_config('app.internal_caller', '', true);
      PERFORM pg_catalog.set_config('app.override_reason', '', true);
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_invoice_status_atomic(
  p_invoice_id uuid,
  p_new_status text,
  p_updated_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid;
  v_invoice record;
  v_transaction_id uuid;
BEGIN
  BEGIN
    v_actor := auth.uid();

    IF v_actor IS NULL AND COALESCE(current_setting('app.internal_caller', true), '') = '' THEN
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

    IF v_actor IS NOT NULL THEN
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
        ARRAY['admin'::public.user_role, 'owner'::public.user_role, 'instructor'::public.user_role]
      ) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Forbidden',
          'message', 'Insufficient permissions to update invoice status'
        );
      END IF;
    END IF;

    PERFORM pg_catalog.set_config('app.internal_caller', 'update_invoice_status_atomic', true);

    UPDATE public.invoices
    SET
      status = p_new_status::public.invoice_status,
      updated_at = p_updated_at
    WHERE id = p_invoice_id
      AND tenant_id = v_invoice.tenant_id;

    PERFORM pg_catalog.set_config('app.internal_caller', '', true);

    IF v_invoice.status = 'draft' AND p_new_status IN ('authorised', 'paid') THEN
      INSERT INTO public.transactions (
        user_id, tenant_id, type, amount, description, metadata, status, completed_at, invoice_id
      ) VALUES (
        v_invoice.user_id,
        v_invoice.tenant_id,
        'debit',
        v_invoice.total_amount,
        'Invoice: ' || v_invoice.invoice_number,
        jsonb_build_object(
          'invoice_id', v_invoice.id,
          'invoice_number', v_invoice.invoice_number,
          'transaction_type', 'invoice_debit'
        ),
        'completed',
        now(),
        v_invoice.id
      ) RETURNING id INTO v_transaction_id;

    ELSIF v_invoice.status IN ('authorised', 'paid') AND p_new_status = 'cancelled' THEN
      SELECT id
      INTO v_transaction_id
      FROM public.transactions
      WHERE user_id = v_invoice.user_id
        AND tenant_id = v_invoice.tenant_id
        AND type = 'debit'
        AND status = 'completed'
        AND metadata->>'invoice_id' = v_invoice.id::text
        AND metadata->>'transaction_type' = 'invoice_debit'
      LIMIT 1;

      IF FOUND THEN
        INSERT INTO public.transactions (
          user_id, tenant_id, type, amount, description, metadata, status, completed_at, invoice_id
        ) VALUES (
          v_invoice.user_id,
          v_invoice.tenant_id,
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
          now(),
          v_invoice.id
        ) RETURNING id INTO v_transaction_id;
      END IF;

    ELSIF v_invoice.status = 'cancelled' AND p_new_status IN ('authorised', 'paid') THEN
      INSERT INTO public.transactions (
        user_id, tenant_id, type, amount, description, metadata, status, completed_at, invoice_id
      ) VALUES (
        v_invoice.user_id,
        v_invoice.tenant_id,
        'debit',
        v_invoice.total_amount,
        'Invoice: ' || v_invoice.invoice_number,
        jsonb_build_object(
          'invoice_id', v_invoice.id,
          'invoice_number', v_invoice.invoice_number,
          'transaction_type', 'invoice_debit'
        ),
        'completed',
        now(),
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
      PERFORM pg_catalog.set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'invoice_id', p_invoice_id,
        'message', 'Transaction rolled back due to error'
      );
  END;
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

CREATE OR REPLACE FUNCTION public.void_and_reissue_xero_invoice(
  p_invoice_id uuid,
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
  v_invoice record;
  v_xero_invoice record;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Reason required', 'message', 'A reason must be provided for voiding');
    END IF;

    SELECT *
    INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    SELECT *
    INTO v_xero_invoice
    FROM public.xero_invoices
    WHERE invoice_id = p_invoice_id
      AND export_status = 'exported'
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not exported', 'message', 'Invoice is not currently exported to Xero');
    END IF;

    v_tenant_id := COALESCE(v_xero_invoice.tenant_id, v_invoice.tenant_id);
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
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Only admins can void and reissue invoices');
    END IF;

    UPDATE public.xero_invoices
    SET export_status = 'voided'::public.xero_export_status,
        error_message = 'Voided for reissue: ' || p_reason,
        updated_at = now()
    WHERE id = v_xero_invoice.id
      AND tenant_id = v_tenant_id;

    INSERT INTO public.xero_export_logs (
      tenant_id, invoice_id, action, status, error_message, initiated_by
    ) VALUES (
      v_tenant_id,
      p_invoice_id,
      'void_for_reissue',
      'success',
      p_reason,
      v_actor
    );

    INSERT INTO public.admin_override_audit (
      table_name, record_id, changed_by, reason, old_data, new_data
    ) VALUES (
      'xero_invoices',
      v_xero_invoice.id,
      v_actor,
      'Void for reissue: ' || p_reason,
      to_jsonb(v_xero_invoice),
      jsonb_build_object('export_status', 'voided')
    );

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'xero_invoice_id', v_xero_invoice.xero_invoice_id,
      'message', 'Xero invoice voided locally. Call Xero API to void remotely, then re-export.'
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'message', 'Void and reissue rolled back');
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invoice_atomic(
  p_user_id uuid,
  p_booking_id uuid DEFAULT NULL,
  p_status text DEFAULT 'draft',
  p_invoice_number text DEFAULT NULL,
  p_tax_rate numeric DEFAULT NULL,
  p_issue_date timestamptz DEFAULT now(),
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
  v_booking_user_id uuid;
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

    IF p_user_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid user', 'message', 'User is required');
    END IF;

    IF p_status NOT IN ('draft', 'authorised') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status', 'message', 'Only draft or authorised status is allowed at creation time');
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing invoice items', 'message', 'Invoice must include at least one item');
    END IF;

    IF p_booking_id IS NOT NULL THEN
      SELECT b.tenant_id, b.user_id
      INTO v_tenant_id, v_booking_user_id
      FROM public.bookings b
      WHERE b.id = p_booking_id
      FOR UPDATE;

      IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
      END IF;

      IF v_booking_user_id IS DISTINCT FROM p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'User mismatch', 'message', 'Booking user does not match invoice user');
      END IF;
    ELSE
      SELECT tu_target.tenant_id
      INTO v_tenant_id
      FROM public.tenant_users tu_target
      JOIN public.tenant_users tu_actor ON tu_actor.tenant_id = tu_target.tenant_id
      JOIN public.roles r_actor ON r_actor.id = tu_actor.role_id
      WHERE tu_target.user_id = p_user_id
        AND tu_target.is_active = true
        AND tu_actor.user_id = v_actor
        AND tu_actor.is_active = true
        AND r_actor.is_active = true
        AND r_actor.name = ANY(ARRAY['admin'::public.user_role, 'owner'::public.user_role, 'instructor'::public.user_role])
      ORDER BY tu_target.created_at
      LIMIT 1;
    END IF;

    IF v_tenant_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Unable to resolve tenant scope');
    END IF;

    IF NOT public.user_belongs_to_tenant(v_tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Access denied');
    END IF;

    IF NOT public.check_user_role_simple(
      v_actor,
      v_tenant_id,
      ARRAY['admin'::public.user_role, 'owner'::public.user_role, 'instructor'::public.user_role]
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to create invoices');
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      WHERE tu.tenant_id = v_tenant_id
        AND tu.user_id = p_user_id
        AND tu.is_active = true
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Member not found', 'message', 'User is not an active member of the tenant');
    END IF;

    v_issue_date := COALESCE(p_issue_date, now());
    v_due_date := COALESCE(p_due_date, v_issue_date + interval '30 days');
    v_tax_rate := COALESCE(p_tax_rate, 0.15);

    IF v_tax_rate < 0 OR v_tax_rate > 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid tax_rate', 'message', 'tax_rate must be between 0 and 1');
    END IF;

    v_invoice_number := COALESCE(p_invoice_number, public.generate_invoice_number_app());
    PERFORM pg_catalog.set_config('app.internal_caller', 'create_invoice_atomic', true);

    INSERT INTO public.invoices (
      user_id, tenant_id, booking_id, status, invoice_number, issue_date, due_date,
      reference, notes, tax_rate, subtotal, tax_total, total_amount, total_paid, balance_due
    ) VALUES (
      p_user_id, v_tenant_id, p_booking_id, 'draft'::public.invoice_status, v_invoice_number,
      v_issue_date, v_due_date, p_reference, p_notes, v_tax_rate, 0, 0, 0, 0, 0
    ) RETURNING id INTO v_invoice_id;

    PERFORM pg_catalog.set_config('app.internal_caller', '', true);

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
        user_id, tenant_id, type, status, amount, description, metadata, completed_at, invoice_id
      ) VALUES (
        p_user_id, v_tenant_id, 'adjustment'::public.transaction_type, 'completed'::public.transaction_status,
        v_total_amount, 'Draft invoice created: ' || v_invoice_number,
        jsonb_build_object(
          'invoice_id', v_invoice_id,
          'invoice_number', v_invoice_number,
          'booking_id', p_booking_id,
          'transaction_type', 'invoice_created',
          'created_by', v_actor
        ),
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
      PERFORM pg_catalog.set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', SQLSTATE, 'message', 'Atomic invoice creation rolled back due to error');
  END;
END;
$$;
