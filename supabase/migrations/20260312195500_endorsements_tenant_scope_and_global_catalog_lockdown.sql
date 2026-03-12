-- Refactor endorsements to tenant-scoped records and harden global catalogs.
-- - endorsements: add tenant_id, backfill tenant rows, tenant-scoped RLS
-- - licenses: global read-only (no authenticated write policy)
-- - users_endorsements: enforce endorsement tenant match in write policy

BEGIN;

-- ---------------------------------------------------------------------------
-- Global catalogs must be read-only to authenticated tenant users.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS licenses_global_manage ON public.licenses;

-- ---------------------------------------------------------------------------
-- endorsements: convert from global to tenant-scoped.
-- ---------------------------------------------------------------------------
ALTER TABLE public.endorsements
  DROP CONSTRAINT IF EXISTS endorsements_name_key;

ALTER TABLE public.endorsements
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Clone legacy global endorsements (tenant_id IS NULL) into each tenant.
INSERT INTO public.endorsements (
  id,
  tenant_id,
  name,
  description,
  is_active,
  created_at,
  updated_at,
  voided_at
)
SELECT
  gen_random_uuid(),
  t.id,
  e.name,
  e.description,
  e.is_active,
  e.created_at,
  e.updated_at,
  e.voided_at
FROM public.endorsements e
CROSS JOIN public.tenants t
WHERE e.tenant_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.endorsements ex
    WHERE ex.tenant_id = t.id
      AND ex.name = e.name
  );

-- Remap existing user endorsement rows to tenant-scoped endorsement ids.
UPDATE public.users_endorsements ue
SET endorsement_id = scoped.id
FROM public.endorsements legacy
JOIN public.endorsements scoped
  ON scoped.name = legacy.name
WHERE ue.endorsement_id = legacy.id
  AND scoped.tenant_id = ue.tenant_id
  AND legacy.tenant_id IS NULL;

-- Remove legacy global rows after remapping.
DELETE FROM public.endorsements e
WHERE e.tenant_id IS NULL;

ALTER TABLE public.endorsements
  ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'endorsements_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.endorsements
      ADD CONSTRAINT endorsements_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'endorsements_tenant_name_key'
  ) THEN
    ALTER TABLE public.endorsements
      ADD CONSTRAINT endorsements_tenant_name_key UNIQUE (tenant_id, name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS endorsements_tenant_active_idx
  ON public.endorsements (tenant_id, is_active, name);

DROP POLICY IF EXISTS endorsements_global_select ON public.endorsements;
DROP POLICY IF EXISTS endorsements_global_manage ON public.endorsements;

CREATE POLICY endorsements_tenant_select
ON public.endorsements
FOR SELECT
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['instructor'::public.user_role, 'admin'::public.user_role, 'owner'::public.user_role]
  )
);

CREATE POLICY endorsements_tenant_manage
ON public.endorsements
FOR ALL
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['admin'::public.user_role, 'owner'::public.user_role]
  )
)
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['admin'::public.user_role, 'owner'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- users_endorsements: ensure writes can only reference endorsements
-- in the same tenant.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_endorsements_tenant_manage ON public.users_endorsements;

CREATE POLICY users_endorsements_tenant_manage
ON public.users_endorsements
FOR ALL
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
)
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
  AND EXISTS (
    SELECT 1
    FROM public.endorsements e
    WHERE e.id = users_endorsements.endorsement_id
      AND e.tenant_id = users_endorsements.tenant_id
  )
);

COMMIT;
