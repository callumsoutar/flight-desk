-- Final cleanup pass (safe subset):
-- - Add missing covering index for email_logs_triggered_by_fkey.
-- - Apply auth initplan pattern to flagged RLS policies.
-- Note: pg_net extension schema move is not supported via SET SCHEMA.

CREATE INDEX IF NOT EXISTS idx_email_logs_triggered_by
ON public.email_logs USING btree (triggered_by);

DROP POLICY IF EXISTS roles_read_active ON public.roles;
CREATE POLICY roles_read_active
ON public.roles
FOR SELECT
TO public
USING (((SELECT auth.uid()) IS NOT NULL) AND is_active = true);

DROP POLICY IF EXISTS email_trigger_configs_insert ON public.email_trigger_configs;
CREATE POLICY email_trigger_configs_insert
ON public.email_trigger_configs
FOR INSERT
TO public
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    (SELECT auth.uid()),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);

DROP POLICY IF EXISTS email_trigger_configs_update ON public.email_trigger_configs;
CREATE POLICY email_trigger_configs_update
ON public.email_trigger_configs
FOR UPDATE
TO public
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    (SELECT auth.uid()),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);
