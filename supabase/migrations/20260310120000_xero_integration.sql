DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'xero_export_status'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.xero_export_status AS ENUM ('pending', 'exported', 'failed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.xero_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  xero_tenant_id text NOT NULL,
  xero_tenant_name text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  scopes text NOT NULL DEFAULT '',
  connected_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xero_connections_tenant_id_unique UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_xero_connections_tenant_id
  ON public.xero_connections(tenant_id);

COMMENT ON TABLE public.xero_connections IS
  'Stores Xero OAuth2 tokens per tenant. One active connection per tenant. Tokens must never be exposed client-side.';

ALTER TABLE public.xero_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xero_connections_tenant_select" ON public.xero_connections;
CREATE POLICY "xero_connections_tenant_select"
  ON public.xero_connections FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "xero_connections_tenant_insert" ON public.xero_connections;
CREATE POLICY "xero_connections_tenant_insert"
  ON public.xero_connections FOR INSERT
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "xero_connections_tenant_update" ON public.xero_connections;
CREATE POLICY "xero_connections_tenant_update"
  ON public.xero_connections FOR UPDATE
  USING (public.user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "xero_connections_tenant_delete" ON public.xero_connections;
CREATE POLICY "xero_connections_tenant_delete"
  ON public.xero_connections FOR DELETE
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE TABLE IF NOT EXISTS public.xero_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  xero_account_id text NOT NULL,
  code text,
  name text NOT NULL,
  type text,
  status text DEFAULT 'ACTIVE',
  class text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xero_accounts_tenant_xero_id_unique UNIQUE (tenant_id, xero_account_id)
);

CREATE INDEX IF NOT EXISTS idx_xero_accounts_tenant_id ON public.xero_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xero_accounts_code ON public.xero_accounts(tenant_id, code);

ALTER TABLE public.xero_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xero_accounts_tenant_select" ON public.xero_accounts;
CREATE POLICY "xero_accounts_tenant_select"
  ON public.xero_accounts FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "xero_accounts_tenant_manage" ON public.xero_accounts;
CREATE POLICY "xero_accounts_tenant_manage"
  ON public.xero_accounts FOR ALL
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE TABLE IF NOT EXISTS public.xero_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  xero_contact_id text NOT NULL,
  xero_contact_name text,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xero_contacts_tenant_user_unique UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_xero_contacts_tenant_id ON public.xero_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xero_contacts_user_id ON public.xero_contacts(user_id);

ALTER TABLE public.xero_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xero_contacts_tenant_select" ON public.xero_contacts;
CREATE POLICY "xero_contacts_tenant_select"
  ON public.xero_contacts FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "xero_contacts_tenant_manage" ON public.xero_contacts;
CREATE POLICY "xero_contacts_tenant_manage"
  ON public.xero_contacts FOR ALL
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE TABLE IF NOT EXISTS public.xero_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  xero_invoice_id text,
  export_status public.xero_export_status NOT NULL DEFAULT 'pending',
  exported_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xero_invoices_tenant_invoice_unique UNIQUE (tenant_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_xero_invoices_tenant_id ON public.xero_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xero_invoices_invoice_id ON public.xero_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_xero_invoices_export_status
  ON public.xero_invoices(tenant_id, export_status);

ALTER TABLE public.xero_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xero_invoices_tenant_select" ON public.xero_invoices;
CREATE POLICY "xero_invoices_tenant_select"
  ON public.xero_invoices FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "xero_invoices_tenant_manage" ON public.xero_invoices;
CREATE POLICY "xero_invoices_tenant_manage"
  ON public.xero_invoices FOR ALL
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE TABLE IF NOT EXISTS public.xero_export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  action text NOT NULL,
  request_payload jsonb,
  response_payload jsonb,
  status text NOT NULL,
  error_message text,
  initiated_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xero_export_logs_tenant_id ON public.xero_export_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xero_export_logs_invoice_id ON public.xero_export_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_xero_export_logs_created_at
  ON public.xero_export_logs(tenant_id, created_at DESC);

ALTER TABLE public.xero_export_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xero_export_logs_tenant_select" ON public.xero_export_logs;
CREATE POLICY "xero_export_logs_tenant_select"
  ON public.xero_export_logs FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "xero_export_logs_tenant_insert" ON public.xero_export_logs;
CREATE POLICY "xero_export_logs_tenant_insert"
  ON public.xero_export_logs FOR INSERT
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

ALTER TABLE public.chargeables
  ADD COLUMN IF NOT EXISTS gl_code text,
  ADD COLUMN IF NOT EXISTS xero_tax_type text;

COMMENT ON COLUMN public.chargeables.gl_code IS
  'Xero Chart of Accounts code (e.g. "4200"). Validated against xero_accounts at export time.';
COMMENT ON COLUMN public.chargeables.xero_tax_type IS
  'Xero tax type identifier (e.g. "OUTPUT2", "NONE"). Used when building Xero invoice line items.';

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS gl_code text,
  ADD COLUMN IF NOT EXISTS xero_tax_type text;

COMMENT ON COLUMN public.invoice_items.gl_code IS
  'GL code snapshotted from chargeable at invoice creation. Immutable after export.';
COMMENT ON COLUMN public.invoice_items.xero_tax_type IS
  'Tax type snapshotted from chargeable at invoice creation. Immutable after export.';
