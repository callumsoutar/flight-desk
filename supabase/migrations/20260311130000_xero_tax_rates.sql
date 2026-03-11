CREATE TABLE IF NOT EXISTS public.xero_tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  xero_tax_type text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  effective_rate numeric(10,6),
  display_rate text,
  can_apply_to_assets boolean,
  can_apply_to_equity boolean,
  can_apply_to_expenses boolean,
  can_apply_to_liabilities boolean,
  can_apply_to_revenue boolean,
  report_tax_type text,
  updated_date_utc timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xero_tax_rates_tenant_tax_type_unique UNIQUE (tenant_id, xero_tax_type)
);

CREATE INDEX IF NOT EXISTS idx_xero_tax_rates_tenant_status
  ON public.xero_tax_rates(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_xero_tax_rates_tenant_tax_type
  ON public.xero_tax_rates(tenant_id, xero_tax_type);

ALTER TABLE public.xero_tax_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xero_tax_rates_tenant_select" ON public.xero_tax_rates;
CREATE POLICY "xero_tax_rates_tenant_select"
  ON public.xero_tax_rates FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "xero_tax_rates_tenant_insert" ON public.xero_tax_rates;
CREATE POLICY "xero_tax_rates_tenant_insert"
  ON public.xero_tax_rates FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "xero_tax_rates_tenant_update" ON public.xero_tax_rates;
CREATE POLICY "xero_tax_rates_tenant_update"
  ON public.xero_tax_rates FOR UPDATE
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "xero_tax_rates_tenant_delete" ON public.xero_tax_rates;
CREATE POLICY "xero_tax_rates_tenant_delete"
  ON public.xero_tax_rates FOR DELETE
  USING (public.is_tenant_admin(tenant_id));

DROP TRIGGER IF EXISTS set_xero_tax_rates_updated_at ON public.xero_tax_rates;
CREATE TRIGGER set_xero_tax_rates_updated_at
BEFORE UPDATE ON public.xero_tax_rates
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
