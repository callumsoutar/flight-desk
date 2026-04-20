-- Allow instructors to create and update membership records.
--
-- Background:
--   The hardened RLS policies introduced in 20260312190000_security_audit_remediation.sql
--   restricted INSERT/UPDATE/DELETE on public.memberships to the owner and admin
--   roles. In practice, instructors are the operational front-desk users for
--   flight schools and need to be able to:
--     * create a new membership for a student/member
--     * renew an existing membership (which is implemented as an UPDATE)
--   The Create/Renew Membership modal calls create_invoice_atomic (which already
--   permits instructors) and then inserts into public.memberships. The latter
--   was being rejected by the WITH CHECK clause, leaving an orphan invoice.
--
-- Notes:
--   * SELECT remains tenant-scoped (unchanged).
--   * DELETE remains restricted to owner/admin — historical membership records
--     should be deactivated via UPDATE (is_active = false / end_date), not
--     hard-deleted.
--   * Uses (select auth.uid()) per Supabase RLS performance guidance to enable
--     initPlan caching across rows.

begin;

drop policy if exists memberships_tenant_insert on public.memberships;
drop policy if exists memberships_tenant_update on public.memberships;

create policy memberships_tenant_insert
on public.memberships
for insert
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array[
      'owner'::public.user_role,
      'admin'::public.user_role,
      'instructor'::public.user_role
    ]
  )
);

create policy memberships_tenant_update
on public.memberships
for update
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array[
      'owner'::public.user_role,
      'admin'::public.user_role,
      'instructor'::public.user_role
    ]
  )
)
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array[
      'owner'::public.user_role,
      'admin'::public.user_role,
      'instructor'::public.user_role
    ]
  )
);

commit;
