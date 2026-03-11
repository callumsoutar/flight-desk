CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    JOIN public.roles r ON r.id = tu.role_id
    WHERE tu.tenant_id = p_tenant_id
      AND tu.user_id = auth.uid()
      AND tu.is_active = true
      AND r.is_active = true
      AND r.name IN ('owner', 'admin')
  )
$$;

REVOKE ALL ON FUNCTION public.is_tenant_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "xero_connections_tenant_select" ON public.xero_connections;
CREATE POLICY "xero_connections_tenant_select"
  ON public.xero_connections FOR SELECT
  USING (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "xero_connections_tenant_insert" ON public.xero_connections;
CREATE POLICY "xero_connections_tenant_insert"
  ON public.xero_connections FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "xero_connections_tenant_update" ON public.xero_connections;
CREATE POLICY "xero_connections_tenant_update"
  ON public.xero_connections FOR UPDATE
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "xero_connections_tenant_delete" ON public.xero_connections;
CREATE POLICY "xero_connections_tenant_delete"
  ON public.xero_connections FOR DELETE
  USING (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "xero_accounts_tenant_manage" ON public.xero_accounts;
DROP POLICY IF EXISTS "xero_accounts_tenant_insert" ON public.xero_accounts;
DROP POLICY IF EXISTS "xero_accounts_tenant_update" ON public.xero_accounts;
DROP POLICY IF EXISTS "xero_accounts_tenant_delete" ON public.xero_accounts;
CREATE POLICY "xero_accounts_tenant_insert"
  ON public.xero_accounts FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id));
CREATE POLICY "xero_accounts_tenant_update"
  ON public.xero_accounts FOR UPDATE
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));
CREATE POLICY "xero_accounts_tenant_delete"
  ON public.xero_accounts FOR DELETE
  USING (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "xero_contacts_tenant_manage" ON public.xero_contacts;
DROP POLICY IF EXISTS "xero_contacts_tenant_insert" ON public.xero_contacts;
DROP POLICY IF EXISTS "xero_contacts_tenant_update" ON public.xero_contacts;
DROP POLICY IF EXISTS "xero_contacts_tenant_delete" ON public.xero_contacts;
CREATE POLICY "xero_contacts_tenant_insert"
  ON public.xero_contacts FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id));
CREATE POLICY "xero_contacts_tenant_update"
  ON public.xero_contacts FOR UPDATE
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));
CREATE POLICY "xero_contacts_tenant_delete"
  ON public.xero_contacts FOR DELETE
  USING (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "xero_invoices_tenant_manage" ON public.xero_invoices;
DROP POLICY IF EXISTS "xero_invoices_tenant_insert" ON public.xero_invoices;
DROP POLICY IF EXISTS "xero_invoices_tenant_update" ON public.xero_invoices;
DROP POLICY IF EXISTS "xero_invoices_tenant_delete" ON public.xero_invoices;
CREATE POLICY "xero_invoices_tenant_insert"
  ON public.xero_invoices FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id));
CREATE POLICY "xero_invoices_tenant_update"
  ON public.xero_invoices FOR UPDATE
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));
CREATE POLICY "xero_invoices_tenant_delete"
  ON public.xero_invoices FOR DELETE
  USING (public.is_tenant_admin(tenant_id));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_xero_connections_updated_at ON public.xero_connections;
CREATE TRIGGER set_xero_connections_updated_at
BEFORE UPDATE ON public.xero_connections
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_xero_accounts_updated_at ON public.xero_accounts;
CREATE TRIGGER set_xero_accounts_updated_at
BEFORE UPDATE ON public.xero_accounts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_xero_contacts_updated_at ON public.xero_contacts;
CREATE TRIGGER set_xero_contacts_updated_at
BEFORE UPDATE ON public.xero_contacts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_xero_invoices_updated_at ON public.xero_invoices;
CREATE TRIGGER set_xero_invoices_updated_at
BEFORE UPDATE ON public.xero_invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
