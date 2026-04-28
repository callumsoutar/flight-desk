-- Globally unique monotonic receipt numbers for invoice_payments and member_credit_topup transactions.
-- One shared sequence; triggers assign on INSERT; RPC responses include receipt_number for the UI.

CREATE SEQUENCE public.payment_receipt_number_seq
  AS bigint
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS receipt_number bigint;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS receipt_number bigint;

-- Backfill runs as the migration role; audit triggers insert into audit_logs and require tenancy context.
ALTER TABLE public.invoice_payments DISABLE TRIGGER invoice_payments_audit_trigger;
ALTER TABLE public.transactions DISABLE TRIGGER transactions_audit_trigger;

-- Backfill: single global ordering by event time, then stable id tie-breaker
WITH unified AS (
  SELECT
    'ip'::text AS src,
    ip.id AS payment_id,
    NULL::uuid AS txn_id,
    COALESCE(ip.paid_at, ip.created_at) AS sort_ts
  FROM public.invoice_payments ip
  UNION ALL
  SELECT
    'mc',
    NULL,
    t.id,
    COALESCE(t.completed_at, t.created_at)
  FROM public.transactions t
  WHERE t.type = 'credit'
    AND t.status = 'completed'
    AND COALESCE(t.metadata->>'transaction_type', '') = 'member_credit_topup'
),
numbered AS (
  SELECT
    src,
    payment_id,
    txn_id,
    ROW_NUMBER() OVER (
      ORDER BY sort_ts ASC, COALESCE(payment_id::text, txn_id::text)
    ) AS rn
  FROM unified
)
UPDATE public.invoice_payments ip
SET receipt_number = n.rn
FROM numbered n
WHERE n.src = 'ip'
  AND n.payment_id IS NOT NULL
  AND ip.id = n.payment_id;

WITH unified AS (
  SELECT
    'ip'::text AS src,
    ip.id AS payment_id,
    NULL::uuid AS txn_id,
    COALESCE(ip.paid_at, ip.created_at) AS sort_ts
  FROM public.invoice_payments ip
  UNION ALL
  SELECT
    'mc',
    NULL,
    t.id,
    COALESCE(t.completed_at, t.created_at)
  FROM public.transactions t
  WHERE t.type = 'credit'
    AND t.status = 'completed'
    AND COALESCE(t.metadata->>'transaction_type', '') = 'member_credit_topup'
),
numbered AS (
  SELECT
    src,
    payment_id,
    txn_id,
    ROW_NUMBER() OVER (
      ORDER BY sort_ts ASC, COALESCE(payment_id::text, txn_id::text)
    ) AS rn
  FROM unified
)
UPDATE public.transactions t
SET receipt_number = n.rn
FROM numbered n
WHERE n.src = 'mc'
  AND n.txn_id IS NOT NULL
  AND t.id = n.txn_id;

ALTER TABLE public.invoice_payments ENABLE TRIGGER invoice_payments_audit_trigger;
ALTER TABLE public.transactions ENABLE TRIGGER transactions_audit_trigger;

ALTER TABLE public.invoice_payments
  ALTER COLUMN receipt_number SET NOT NULL;

CREATE UNIQUE INDEX invoice_payments_receipt_number_key
  ON public.invoice_payments (receipt_number);

CREATE UNIQUE INDEX transactions_receipt_number_uidx
  ON public.transactions (receipt_number)
  WHERE receipt_number IS NOT NULL;

SELECT setval(
  'public.payment_receipt_number_seq',
  GREATEST(
    COALESCE((SELECT MAX(receipt_number) FROM public.invoice_payments), 0),
    COALESCE((SELECT MAX(receipt_number) FROM public.transactions), 0)
  ),
  true
);

CREATE OR REPLACE FUNCTION public.assign_invoice_payment_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number := nextval('public.payment_receipt_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_member_credit_transaction_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.receipt_number IS NULL
     AND NEW.type = 'credit'
     AND COALESCE(NEW.metadata->>'transaction_type', '') = 'member_credit_topup'
  THEN
    NEW.receipt_number := nextval('public.payment_receipt_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_payments_assign_receipt_number ON public.invoice_payments;
CREATE TRIGGER invoice_payments_assign_receipt_number
  BEFORE INSERT ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_invoice_payment_receipt_number();

DROP TRIGGER IF EXISTS transactions_assign_member_credit_receipt_number ON public.transactions;
CREATE TRIGGER transactions_assign_member_credit_receipt_number
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_member_credit_transaction_receipt_number();

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
  v_receipt_number bigint;
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
    ) RETURNING id, receipt_number INTO v_payment_id, v_receipt_number;

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
      'receipt_number', v_receipt_number,
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
  v_receipt_number bigint;
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
    RETURNING id, receipt_number INTO v_transaction_id, v_receipt_number;

    v_new_balance := public.get_account_balance(p_user_id);

    RETURN jsonb_build_object(
      'success', true,
      'transaction_id', v_transaction_id,
      'receipt_number', v_receipt_number,
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

REVOKE EXECUTE ON FUNCTION public.record_invoice_payment_atomic(uuid, numeric, public.payment_method, text, text, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_member_credit_payment_atomic(uuid, numeric, public.payment_method, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment_atomic(uuid, numeric, public.payment_method, text, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_member_credit_payment_atomic(uuid, numeric, public.payment_method, text, text, timestamptz) TO authenticated, service_role;
