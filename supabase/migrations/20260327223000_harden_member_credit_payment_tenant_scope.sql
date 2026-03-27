-- Harden member credit payment RPC tenant scoping and role checks.

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
