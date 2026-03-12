-- Finance hardening: invoice numbering, Xero lock protection, admin override visibility, and overdue status strategy.

-- 1) Remove legacy broken sequence function.
DROP FUNCTION IF EXISTS public.generate_invoice_number();

-- 2) Ensure invoice status RPC aligns with finance RPC security model.
ALTER FUNCTION public.update_invoice_status_atomic(uuid, text, timestamp with time zone) SECURITY DEFINER;

-- 3) Generate app invoice numbers using tenant-configured prefix.
CREATE OR REPLACE FUNCTION public.generate_invoice_number_app()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_prefix text;
BEGIN
  v_tenant_id := get_user_tenant();

  SELECT NULLIF(TRIM(settings->>'invoice_prefix'), '')
  INTO v_prefix
  FROM public.tenant_settings
  WHERE tenant_id = v_tenant_id
  LIMIT 1;

  RETURN public.generate_invoice_number_with_prefix(COALESCE(v_prefix, 'INV'));
END;
$function$;

-- 4) Protect xero_invoices against hard delete unlocks.
DROP POLICY IF EXISTS xero_invoices_tenant_delete ON public.xero_invoices;

CREATE OR REPLACE FUNCTION public.prevent_xero_invoice_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Hard deletion of xero_invoices is not permitted. Use status transitions (failed/voided/pending/exported).'
    USING ERRCODE = 'P0001';
END;
$function$;

DROP TRIGGER IF EXISTS xero_invoices_no_delete ON public.xero_invoices;
CREATE TRIGGER xero_invoices_no_delete
BEFORE DELETE ON public.xero_invoices
FOR EACH ROW
EXECUTE FUNCTION public.prevent_xero_invoice_delete();

-- 5) Restrict admin override audit visibility and writes to tenant admins/owners.
DROP POLICY IF EXISTS admin_override_audit_tenant_select ON public.admin_override_audit;
CREATE POLICY admin_override_audit_tenant_select
ON public.admin_override_audit
FOR SELECT
USING (
  user_belongs_to_tenant(tenant_id)
  AND tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner'::user_role, 'admin'::user_role])
);

DROP POLICY IF EXISTS admin_override_audit_tenant_insert ON public.admin_override_audit;
CREATE POLICY admin_override_audit_tenant_insert
ON public.admin_override_audit
FOR INSERT
WITH CHECK (
  user_belongs_to_tenant(tenant_id)
  AND tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner'::user_role, 'admin'::user_role])
);

-- 6) Persist Xero-assigned invoice number (for tenant mode that delegates numbering to Xero).
ALTER TABLE public.xero_invoices
ADD COLUMN IF NOT EXISTS xero_invoice_number text;

-- 7) Deprecate stored overdue mutations and rely on computed overdue status in app logic.
UPDATE public.invoices
SET status = 'authorised'::invoice_status,
    updated_at = now()
WHERE status = 'overdue'::invoice_status
  AND deleted_at IS NULL
  AND COALESCE(balance_due, 0) > 0;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'mark-overdue-invoices'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END;
$$;
