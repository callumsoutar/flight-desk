-- Add void_invoice_atomic RPC + supporting trigger/function patches.
-- Voiding an invoice = soft-delete invoice + soft-delete items + insert a
-- balancing 'credit' transaction that nets out the original 'invoice_debit'.
-- Original ledger rows are NEVER mutated or deleted; the audit trail is preserved.
-- Voiding refuses if:
--   * caller is not admin/owner
--   * invoice is missing/already deleted/wrong tenant
--   * invoice is exported to Xero (use void_and_reissue_xero_invoice instead)
--   * invoice has any payments (total_paid > 0) — payments must be reversed first

BEGIN;

-- 1. Skip the recalc-on-item-soft-delete trigger when the parent invoice is
-- already soft-deleted. This avoids re-running update_invoice_totals_atomic
-- for every voided line item during a void.
CREATE OR REPLACE FUNCTION public.recalc_invoice_on_item_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice_deleted boolean;
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    SELECT (deleted_at IS NOT NULL)
    INTO v_invoice_deleted
    FROM public.invoices
    WHERE id = NEW.invoice_id;

    IF COALESCE(v_invoice_deleted, false) THEN
      RETURN NEW;
    END IF;

    PERFORM public.update_invoice_totals_atomic(NEW.invoice_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Add `void_invoice_atomic` to internal_caller allowlist so it can write to
-- approved invoices and their items without tripping the approval guards.
CREATE OR REPLACE FUNCTION public.prevent_approved_invoice_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
    'reverse_invoice_payment_atomic',
    'void_invoice_atomic'
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
$function$;

CREATE OR REPLACE FUNCTION public.prevent_approved_invoice_item_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
    'admin_correct_invoice',
    'void_invoice_atomic'
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
$function$;

-- 3. Fix latent bug in soft_delete_invoice: the transactions table has no
-- deleted_at column, so the existing predicate would error if any row matched.
CREATE OR REPLACE FUNCTION public.soft_delete_invoice(p_invoice_id uuid, p_user_id uuid, p_reason text DEFAULT 'User initiated deletion'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
      'error', 'Cannot delete approved invoice. Use void instead.',
      'invoice_number', v_invoice.invoice_number,
      'status', v_invoice.status,
      'hint', 'Only draft invoices can be deleted. Use void_invoice_atomic for approved invoices.'
    );
  END IF;

  SELECT COUNT(*)
  INTO v_transaction_count
  FROM public.transactions t
  WHERE t.invoice_id = p_invoice_id
    AND t.tenant_id = v_invoice.tenant_id
    AND t.status = 'completed'::public.transaction_status
    AND t.type IN ('debit'::public.transaction_type, 'credit'::public.transaction_type);

  IF v_transaction_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invoice has associated ledger transactions and cannot be deleted',
      'transaction_count', v_transaction_count,
      'invoice_number', v_invoice.invoice_number,
      'hint', 'Use void_invoice_atomic to reverse the ledger entries and soft-delete the invoice.'
    );
  END IF;

  PERFORM pg_catalog.set_config('app.internal_caller', 'soft_delete_invoice', true);
  UPDATE public.invoices
  SET
    deleted_at = now(),
    deleted_by = v_actor,
    deletion_reason = p_reason,
    status = 'cancelled'::public.invoice_status,
    updated_at = now()
  WHERE id = p_invoice_id
    AND tenant_id = v_invoice.tenant_id;
  PERFORM pg_catalog.set_config('app.internal_caller', '', true);

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
    'message', 'Draft invoice and all associated items have been soft deleted'
  );

EXCEPTION
  WHEN OTHERS THEN
    PERFORM pg_catalog.set_config('app.internal_caller', '', true);
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'invoice_id', p_invoice_id,
      'message', 'An error occurred during soft delete'
    );
END;
$function$;

-- 4. The new RPC. Voids an approved/overdue invoice in a single transaction:
--   - Refuses if Xero-exported, has payments, or caller lacks admin/owner.
--   - Soft-deletes the invoice (status -> 'cancelled', deleted_at, reason).
--   - Soft-deletes all invoice items.
--   - Inserts a balancing 'credit' transaction that reverses the original
--     'invoice_debit' so the user's account balance returns to its prior state.
--     The original debit row is left intact for audit/GST integrity.
--   - Records an admin_override_audit row capturing old/new state + reason.
CREATE OR REPLACE FUNCTION public.void_invoice_atomic(p_invoice_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid;
  v_invoice record;
  v_old_invoice jsonb;
  v_total_paid numeric;
  v_xero_locked boolean;
  v_original_debit_id uuid;
  v_reversal_transaction_id uuid;
  v_items_voided int := 0;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized', 'message', 'Authentication required');
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Reason required', 'message', 'A reason must be provided when voiding an invoice');
    END IF;

    SELECT *
    INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Invoice not found');
    END IF;

    IF v_invoice.deleted_at IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Already voided',
        'message', 'Invoice has already been voided',
        'invoice_number', v_invoice.invoice_number,
        'deleted_at', v_invoice.deleted_at
      );
    END IF;

    IF NOT public.user_belongs_to_tenant(v_invoice.tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Access denied');
    END IF;

    IF NOT public.check_user_role_simple(
      v_actor,
      v_invoice.tenant_id,
      ARRAY['admin'::public.user_role, 'owner'::public.user_role]
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Only admins or owners can void invoices');
    END IF;

    v_xero_locked := public.invoice_is_xero_exported(p_invoice_id);
    IF v_xero_locked THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Xero locked',
        'message', 'Invoice is exported to Xero. Use the void-and-reissue Xero workflow instead.',
        'invoice_number', v_invoice.invoice_number
      );
    END IF;

    v_total_paid := COALESCE(v_invoice.total_paid, 0);
    IF v_total_paid > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Has payments',
        'message', 'Reverse all payments before voiding this invoice',
        'invoice_number', v_invoice.invoice_number,
        'total_paid', v_total_paid
      );
    END IF;

    IF v_invoice.status = 'cancelled'::public.invoice_status THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Already cancelled',
        'message', 'Invoice is already cancelled',
        'invoice_number', v_invoice.invoice_number
      );
    END IF;

    v_old_invoice := to_jsonb(v_invoice);

    -- Step 1: insert balancing ledger entry (only if there was an authorised
    -- debit row; draft invoices only carry an audit-only 'adjustment' row that
    -- doesn't impact account balance, so no reversal is required).
    SELECT t.id
    INTO v_original_debit_id
    FROM public.transactions t
    WHERE t.invoice_id = p_invoice_id
      AND t.tenant_id = v_invoice.tenant_id
      AND t.type = 'debit'::public.transaction_type
      AND t.status = 'completed'::public.transaction_status
      AND t.metadata->>'transaction_type' = 'invoice_debit'
    LIMIT 1;

    IF v_original_debit_id IS NOT NULL THEN
      INSERT INTO public.transactions (
        user_id,
        tenant_id,
        type,
        status,
        amount,
        description,
        metadata,
        completed_at,
        invoice_id
      ) VALUES (
        v_invoice.user_id,
        v_invoice.tenant_id,
        'credit'::public.transaction_type,
        'completed'::public.transaction_status,
        v_invoice.total_amount,
        'Void of Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text) || ': ' || p_reason,
        jsonb_build_object(
          'invoice_id', v_invoice.id,
          'invoice_number', v_invoice.invoice_number,
          'transaction_type', 'invoice_void',
          'reversal_of', v_original_debit_id,
          'reason', p_reason,
          'voided_by', v_actor
        ),
        now(),
        v_invoice.id
      ) RETURNING id INTO v_reversal_transaction_id;
    END IF;

    -- Step 2: soft-delete the invoice. set internal_caller so the approval
    -- guard allows the status/deleted_at change in one update.
    PERFORM pg_catalog.set_config('app.internal_caller', 'void_invoice_atomic', true);
    UPDATE public.invoices
    SET
      status = 'cancelled'::public.invoice_status,
      deleted_at = now(),
      deleted_by = v_actor,
      deletion_reason = p_reason,
      updated_at = now()
    WHERE id = p_invoice_id
      AND tenant_id = v_invoice.tenant_id;
    PERFORM pg_catalog.set_config('app.internal_caller', '', true);

    -- Step 3: soft-delete invoice items. The recalc trigger now early-returns
    -- because the parent invoice is already soft-deleted.
    PERFORM pg_catalog.set_config('app.internal_caller', 'void_invoice_atomic', true);
    UPDATE public.invoice_items
    SET
      deleted_at = now(),
      deleted_by = v_actor,
      updated_at = now()
    WHERE invoice_id = p_invoice_id
      AND tenant_id = v_invoice.tenant_id
      AND deleted_at IS NULL;
    GET DIAGNOSTICS v_items_voided = ROW_COUNT;
    PERFORM pg_catalog.set_config('app.internal_caller', '', true);

    -- Step 4: write override audit row capturing the void action.
    INSERT INTO public.admin_override_audit (
      table_name, record_id, changed_by, reason, old_data, new_data
    ) VALUES (
      'invoices',
      p_invoice_id,
      v_actor,
      'Invoice voided: ' || p_reason,
      v_old_invoice,
      jsonb_build_object(
        'status', 'cancelled',
        'deleted_at', now(),
        'deleted_by', v_actor,
        'deletion_reason', p_reason,
        'reversal_transaction_id', v_reversal_transaction_id,
        'items_voided', v_items_voided
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'invoice_number', v_invoice.invoice_number,
      'reversal_transaction_id', v_reversal_transaction_id,
      'items_voided', v_items_voided,
      'reason', p_reason,
      'message', CASE
        WHEN v_reversal_transaction_id IS NOT NULL
          THEN 'Invoice voided, items soft-deleted, and ledger reversal posted'
        ELSE 'Draft invoice voided and items soft-deleted (no ledger reversal needed)'
      END
    );

  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_catalog.set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'message', 'Void rolled back due to error'
      );
  END;
END;
$function$;

-- 5. Tighten execute permissions: only authenticated users can call, RLS &
-- in-function role checks enforce the rest.
REVOKE ALL ON FUNCTION public.void_invoice_atomic(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_invoice_atomic(uuid, text) TO authenticated;

COMMIT;
