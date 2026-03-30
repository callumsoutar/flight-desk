-- Allow member and student roles to UPDATE rows where they are the booked user.
-- Migration 20260327222448 restricted bookings_tenant_update WITH CHECK to staff-only,
-- which caused all updates (including own-booking edits and cancellation fields) to fail at RLS.

DROP POLICY IF EXISTS bookings_tenant_update ON public.bookings;
CREATE POLICY bookings_tenant_update
ON public.bookings
FOR UPDATE
TO public
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND (
    public.tenant_user_has_role(
      (SELECT auth.uid()),
      tenant_id,
      ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
    )
    OR user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND (
    public.tenant_user_has_role(
      (SELECT auth.uid()),
      tenant_id,
      ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
    )
    OR user_id = (SELECT auth.uid())
  )
);
