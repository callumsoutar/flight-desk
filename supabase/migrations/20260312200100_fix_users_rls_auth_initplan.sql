-- Performance advisor: auth_rls_initplan
-- Wrap auth.uid() in (SELECT auth.uid()) so it's evaluated once per query, not per row
DROP POLICY IF EXISTS users_update ON public.users;
DROP POLICY IF EXISTS users_select ON public.users;

CREATE POLICY users_update ON public.users
  FOR UPDATE
  USING ((id = (SELECT auth.uid())) OR can_manage_user(id));

CREATE POLICY users_select ON public.users
  FOR SELECT
  USING ((id = (SELECT auth.uid())) OR users_share_tenant(id));
