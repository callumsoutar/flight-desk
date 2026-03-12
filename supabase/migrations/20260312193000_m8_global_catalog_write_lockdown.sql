-- M8 hardening: remove tenant-user write access to global catalogs.
-- These catalogs remain readable via existing SELECT policies, but mutation
-- is no longer available to authenticated tenant users.

BEGIN;

DROP POLICY IF EXISTS endorsements_global_manage ON public.endorsements;

DROP POLICY IF EXISTS instructor_categories_global_insert ON public.instructor_categories;
DROP POLICY IF EXISTS instructor_categories_global_update ON public.instructor_categories;
DROP POLICY IF EXISTS instructor_categories_global_delete ON public.instructor_categories;

COMMIT;
