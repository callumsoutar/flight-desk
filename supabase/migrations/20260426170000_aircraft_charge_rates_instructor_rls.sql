-- App route POST /api/aircraft-charge-rates allows staff (owner, admin, instructor).
-- RLS previously only allowed owner/admin, so instructor inserts failed with RLS violation (500).
-- Align write policies with staff role used by the API.
--
-- Uses (select auth.uid()) per Supabase RLS performance guidance (initPlan caching).

begin;

drop policy if exists aircraft_charge_rates_tenant_insert on public.aircraft_charge_rates;
drop policy if exists aircraft_charge_rates_tenant_update on public.aircraft_charge_rates;
drop policy if exists aircraft_charge_rates_tenant_delete on public.aircraft_charge_rates;

create policy aircraft_charge_rates_tenant_insert
  on public.aircraft_charge_rates
  for insert
  to public
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

create policy aircraft_charge_rates_tenant_update
  on public.aircraft_charge_rates
  for update
  to public
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

create policy aircraft_charge_rates_tenant_delete
  on public.aircraft_charge_rates
  for delete
  to public
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
  );

commit;
