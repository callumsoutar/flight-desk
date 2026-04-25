-- Remove legacy payment_method enum values: check, online_payment.
-- Remap existing rows to 'other', replace enum, restore RPCs that reference public.payment_method.

-- 1) Normalize stored values
UPDATE public.invoice_payments
SET payment_method = 'other'
WHERE payment_method::text IN ('check', 'online_payment');

UPDATE public.invoices
SET payment_method = 'other'
WHERE payment_method::text IN ('check', 'online_payment');

-- Views that select invoices.payment_method must be dropped before ALTER TYPE
DROP VIEW IF EXISTS public.invoice_effective_status;

-- 2) Drop RPCs that use public.payment_method in their signature
DROP FUNCTION IF EXISTS public.record_invoice_payment_atomic(
  uuid, numeric, public.payment_method, text, text, timestamptz
);
DROP FUNCTION IF EXISTS public.record_member_credit_payment_atomic(
  uuid, numeric, public.payment_method, text, text, timestamptz
);

-- 3) Detach table columns from the enum
ALTER TABLE public.invoice_payments
  ALTER COLUMN payment_method SET DATA TYPE text
  USING (payment_method::text);

ALTER TABLE public.invoices
  ALTER COLUMN payment_method SET DATA TYPE text
  USING (payment_method::text);

-- 4) Drop old enum (no longer referenced by functions or columns)
DROP TYPE public.payment_method;

-- 5) Recreate enum without check / online_payment
CREATE TYPE public.payment_method AS ENUM (
  'cash',
  'credit_card',
  'debit_card',
  'bank_transfer',
  'other'
);

-- 6) Bind columns to the new enum
ALTER TABLE public.invoice_payments
  ALTER COLUMN payment_method SET DATA TYPE public.payment_method
  USING (
    CASE COALESCE(lower(trim(payment_method)), '')
      WHEN 'check' THEN 'other'::public.payment_method
      WHEN 'online_payment' THEN 'other'::public.payment_method
      WHEN 'cash' THEN 'cash'::public.payment_method
      WHEN 'credit_card' THEN 'credit_card'::public.payment_method
      WHEN 'debit_card' THEN 'debit_card'::public.payment_method
      WHEN 'bank_transfer' THEN 'bank_transfer'::public.payment_method
      WHEN 'other' THEN 'other'::public.payment_method
      ELSE 'other'::public.payment_method
    END
  );

ALTER TABLE public.invoices
  ALTER COLUMN payment_method SET DATA TYPE public.payment_method
  USING (
    CASE
      WHEN payment_method IS NULL THEN NULL
      WHEN lower(trim(payment_method)) IN ('check', 'online_payment') THEN 'other'::public.payment_method
      WHEN lower(trim(payment_method)) = 'cash' THEN 'cash'::public.payment_method
      WHEN lower(trim(payment_method)) = 'credit_card' THEN 'credit_card'::public.payment_method
      WHEN lower(trim(payment_method)) = 'debit_card' THEN 'debit_card'::public.payment_method
      WHEN lower(trim(payment_method)) = 'bank_transfer' THEN 'bank_transfer'::public.payment_method
      WHEN lower(trim(payment_method)) = 'other' THEN 'other'::public.payment_method
      ELSE 'other'::public.payment_method
    END
  );

-- 7) Restore atomic payment RPCs (must match latest hardened definitions)

CREATE OR REPLACE FUNCTION public.record_invoice_payment_atomic(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method public.payment_method,
  p_payment_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid;
  v_tenant_id uuid;
  v_invoice_user_id uuid;
  v_invoice_number text;
  v_invoice_status public.invoice_status;
  v_issue_date timestamptz;
  v_total_amount numeric;
  v_total_paid numeric;
  v_balance_due numeric;
  v_new_total_paid numeric;
  v_new_balance_due numeric;
  v_transaction_id uuid;
  v_payment_id uuid;
  v_paid_date timestamptz;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized', 'message', 'Authentication required');
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid amount', 'message', 'Payment amount must be greater than zero');
    END IF;

    SELECT
      i.tenant_id,
      i.user_id,
      i.invoice_number,
      i.status,
      i.issue_date,
      COALESCE(i.total_amount, 0),
      COALESCE(i.total_paid, 0),
      COALESCE(i.balance_due, GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.total_paid, 0)))
    INTO
      v_tenant_id,
      v_invoice_user_id,
      v_invoice_number,
      v_invoice_status,
      v_issue_date,
      v_total_amount,
      v_total_paid,
      v_balance_due
    FROM public.invoices i
    WHERE i.id = p_invoice_id
      AND i.deleted_at IS NULL
    FOR UPDATE;

    IF v_invoice_user_id IS NULL OR v_tenant_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Invoice not found');
    END IF;

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
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to record payments');
    END IF;

    IF v_invoice_status IN ('cancelled', 'refunded') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid invoice status', 'message', 'Cannot record payments for cancelled or refunded invoices');
    END IF;

    IF v_balance_due <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already paid', 'message', 'Invoice has no remaining balance');
    END IF;

    IF p_amount > v_balance_due THEN
      RETURN jsonb_build_object('success', false, 'error', 'Overpayment', 'message', 'Payment amount cannot exceed the remaining balance', 'balance_due', v_balance_due);
    END IF;

    v_new_total_paid := round(v_total_paid + p_amount, 2);
    v_new_balance_due := round(GREATEST(0, v_total_amount - v_new_total_paid), 2);
    v_paid_date := GREATEST(COALESCE(p_paid_at, now()), COALESCE(v_issue_date, now()));

    INSERT INTO public.transactions (
      user_id, tenant_id, type, status, amount, description, metadata, completed_at, invoice_id
    ) VALUES (
      v_invoice_user_id,
      v_tenant_id,
      'adjustment'::public.transaction_type,
      'completed'::public.transaction_status,
      round(p_amount, 2),
      'Invoice payment received: ' || COALESCE(v_invoice_number, p_invoice_id::text),
      jsonb_build_object(
        'invoice_id', p_invoice_id,
        'invoice_number', v_invoice_number,
        'transaction_type', 'invoice_payment',
        'payment_method', p_payment_method::text,
        'payment_reference', p_payment_reference,
        'created_by', v_actor
      ),
      v_paid_date,
      p_invoice_id
    ) RETURNING id INTO v_transaction_id;

    INSERT INTO public.invoice_payments (
      invoice_id, user_id, tenant_id, amount, payment_method, payment_reference, notes, paid_at, transaction_id, created_by
    ) VALUES (
      p_invoice_id, v_invoice_user_id, v_tenant_id, round(p_amount, 2), p_payment_method, p_payment_reference, p_notes, v_paid_date, v_transaction_id, v_actor
    ) RETURNING id INTO v_payment_id;

    PERFORM pg_catalog.set_config('app.internal_caller', 'record_invoice_payment_atomic', true);

    UPDATE public.invoices
    SET
      total_paid = v_new_total_paid,
      balance_due = v_new_balance_due,
      payment_method = p_payment_method,
      payment_reference = p_payment_reference,
      paid_date = CASE WHEN v_new_balance_due <= 0 THEN v_paid_date ELSE paid_date END,
      status = CASE WHEN v_new_balance_due <= 0 THEN 'paid'::public.invoice_status ELSE status END,
      updated_at = now()
    WHERE id = p_invoice_id
      AND tenant_id = v_tenant_id;

    PERFORM pg_catalog.set_config('app.internal_caller', '', true);

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'payment_id', v_payment_id,
      'transaction_id', v_transaction_id,
      'new_total_paid', v_new_total_paid,
      'new_balance_due', v_new_balance_due,
      'new_status', CASE WHEN v_new_balance_due <= 0 THEN 'paid' ELSE v_invoice_status::text END,
      'message', 'Payment recorded atomically'
    );

  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_catalog.set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', SQLSTATE, 'message', 'Atomic payment recording rolled back due to error');
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_member_credit_payment_atomic(
  p_user_id uuid,
  p_amount numeric,
  p_payment_method public.payment_method,
  p_payment_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid;
  v_tenant_id uuid;
  v_user_exists boolean := false;
  v_transaction_id uuid;
  v_amount numeric;
  v_paid_at timestamptz;
  v_new_balance numeric;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Unauthorized',
        'message', 'Authentication required'
      );
    END IF;

    v_tenant_id := public.get_user_tenant(v_actor);
    IF v_tenant_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Missing tenant context',
        'message', 'Unable to resolve tenant context'
      );
    END IF;

    IF NOT public.user_belongs_to_tenant(v_tenant_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Forbidden',
        'message', 'Access denied'
      );
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
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Forbidden',
        'message', 'Insufficient permissions to record member credit'
      );
    END IF;

    IF p_user_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid member',
        'message', 'Member is required'
      );
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid amount',
        'message', 'Payment amount must be greater than zero'
      );
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      WHERE tu.tenant_id = v_tenant_id
        AND tu.user_id = p_user_id
        AND tu.is_active = true
    )
    INTO v_user_exists;

    IF NOT v_user_exists THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Member not found',
        'message', 'Member is not part of this tenant'
      );
    END IF;

    v_amount := round(p_amount, 2);
    v_paid_at := COALESCE(p_paid_at, now());

    INSERT INTO public.transactions (
      user_id,
      tenant_id,
      type,
      status,
      amount,
      description,
      metadata,
      reference_number,
      completed_at,
      invoice_id
    ) VALUES (
      p_user_id,
      v_tenant_id,
      'credit'::public.transaction_type,
      'completed'::public.transaction_status,
      v_amount,
      'Member credit top-up received',
      jsonb_build_object(
        'transaction_type', 'member_credit_topup',
        'payment_method', p_payment_method::text,
        'payment_reference', NULLIF(trim(COALESCE(p_payment_reference, '')), ''),
        'notes', NULLIF(trim(COALESCE(p_notes, '')), ''),
        'created_by', v_actor
      ),
      NULLIF(trim(COALESCE(p_payment_reference, '')), ''),
      v_paid_at,
      NULL
    )
    RETURNING id INTO v_transaction_id;

    v_new_balance := public.get_account_balance(p_user_id);

    RETURN jsonb_build_object(
      'success', true,
      'transaction_id', v_transaction_id,
      'user_id', p_user_id,
      'amount', v_amount,
      'new_balance', v_new_balance,
      'message', 'Member credit payment recorded atomically'
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'message', 'Atomic member credit payment rolled back due to error'
      );
  END;
END;
$$;

-- Recreate view (20260312190000_security_audit_remediation)
CREATE OR REPLACE VIEW public.invoice_effective_status
WITH (security_invoker = true)
AS
SELECT
  id,
  invoice_number,
  user_id,
  status,
  issue_date,
  due_date,
  paid_date,
  subtotal,
  tax_total,
  total_amount,
  total_paid,
  balance_due,
  notes,
  created_at,
  updated_at,
  booking_id,
  reference,
  payment_method,
  payment_reference,
  tax_rate,
  deleted_at,
  deleted_by,
  deletion_reason,
  tenant_id,
  CASE
    WHEN status = 'authorised'::public.invoice_status AND due_date < now()
      THEN 'overdue'::public.invoice_status
    ELSE status
  END AS effective_status
FROM public.invoices;

-- 8) Match 20260327222513: no PUBLIC, authenticated + service_role only
REVOKE EXECUTE ON FUNCTION public.record_invoice_payment_atomic(uuid, numeric, public.payment_method, text, text, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_member_credit_payment_atomic(uuid, numeric, public.payment_method, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment_atomic(uuid, numeric, public.payment_method, text, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_member_credit_payment_atomic(uuid, numeric, public.payment_method, text, text, timestamptz) TO authenticated, service_role;
