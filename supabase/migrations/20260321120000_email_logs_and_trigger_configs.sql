ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_invoice_id
  ON public.email_logs(invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_tenant_sent
  ON public.email_logs(tenant_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.email_trigger_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trigger_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  from_name text,
  reply_to text,
  subject_template text,
  cc_emails text[],
  notify_instructor boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, trigger_key)
);

ALTER TABLE public.email_trigger_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_trigger_configs_select" ON public.email_trigger_configs;
CREATE POLICY "email_trigger_configs_select"
  ON public.email_trigger_configs FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "email_trigger_configs_insert" ON public.email_trigger_configs;
CREATE POLICY "email_trigger_configs_insert"
  ON public.email_trigger_configs FOR INSERT
  WITH CHECK (
    user_belongs_to_tenant(tenant_id)
    AND tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  );

DROP POLICY IF EXISTS "email_trigger_configs_update" ON public.email_trigger_configs;
CREATE POLICY "email_trigger_configs_update"
  ON public.email_trigger_configs FOR UPDATE
  USING (
    user_belongs_to_tenant(tenant_id)
    AND tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  );

DROP TRIGGER IF EXISTS email_trigger_configs_updated_at ON public.email_trigger_configs;
CREATE TRIGGER email_trigger_configs_updated_at
  BEFORE UPDATE ON public.email_trigger_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_email_trigger_configs_tenant
  ON public.email_trigger_configs(tenant_id, trigger_key);
