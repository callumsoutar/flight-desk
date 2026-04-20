-- Allow instructors to read tenant_users rows for their tenant.
--
-- Background:
-- Previously the tenant_users_select policy only allowed owners and admins to
-- see tenant_users rows other than their own. The application treats
-- instructors as part of the staff tier (isStaffRole) and gives them access to
-- staff-only routes (/members, /bookings, /scheduler, ...). When an instructor
-- opened the New Booking modal in the scheduler, the bookings options endpoint
-- (`app/api/bookings/options/route.ts`) executed:
--
--   from('tenant_users')
--     .select('user:user_directory!tenant_users_user_id_fkey(...)')
--     .eq('tenant_id', tenantId)
--     .eq('is_active', true)
--
-- under the user's session. RLS then filtered the result down to the
-- instructor's own tenant_users row, so the member combobox only displayed the
-- logged-in instructor. The same restriction was silently breaking the
-- /members list and any other staff feature that depends on tenant_users for
-- instructors.
--
-- This migration recreates tenant_users_select so any active staff member
-- (owner, admin, or instructor) can see all tenant_users rows for tenants they
-- belong to. Members and students keep the existing self-only access. Insert,
-- update, and delete policies remain unchanged (still admin/owner only),
-- matching the rest of our admin-only mutation surface for tenant membership.

begin;

drop policy if exists tenant_users_select on public.tenant_users;

create policy tenant_users_select
on public.tenant_users
for select
to public
using (
  user_id = (select auth.uid())
  or public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

commit;
