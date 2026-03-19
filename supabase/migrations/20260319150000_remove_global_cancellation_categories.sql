-- Remove global cancellation category behavior.
-- Re-attribute existing global rows to a specific tenant so all categories are tenant-owned.
-- Also replace hybrid RLS policies that depend on is_global.
begin;

alter table public.cancellation_categories
  drop constraint if exists cancellation_categories_global_no_tenant;

drop policy if exists cancellation_categories_hybrid_select on public.cancellation_categories;
drop policy if exists cancellation_categories_hybrid_insert on public.cancellation_categories;
drop policy if exists cancellation_categories_hybrid_update on public.cancellation_categories;
drop policy if exists cancellation_categories_hybrid_delete on public.cancellation_categories;

update public.cancellation_categories
set
  tenant_id = '8468798c-e37b-4b02-8477-05e62d9b7fe3'::uuid,
  is_global = false,
  updated_at = now()
where is_global = true
   or tenant_id is null;

alter table public.cancellation_categories
  drop column if exists is_global;

create policy cancellation_categories_tenant_select
on public.cancellation_categories
for select
to public
using (
  tenant_id in (
    select tu.tenant_id
    from public.tenant_users tu
    where tu.user_id = (select auth.uid())
      and tu.is_active = true
  )
);

create policy cancellation_categories_tenant_insert
on public.cancellation_categories
for insert
to public
with check (
  tenant_id in (
    select tu.tenant_id
    from public.tenant_users tu
    join public.roles r on r.id = tu.role_id
    where tu.user_id = (select auth.uid())
      and tu.is_active = true
      and r.is_active = true
      and r.name = any (array['owner'::public.user_role, 'admin'::public.user_role])
      and tu.tenant_id = cancellation_categories.tenant_id
  )
);

create policy cancellation_categories_tenant_update
on public.cancellation_categories
for update
to public
using (
  tenant_id in (
    select tu.tenant_id
    from public.tenant_users tu
    join public.roles r on r.id = tu.role_id
    where tu.user_id = (select auth.uid())
      and tu.is_active = true
      and r.is_active = true
      and r.name = any (array['owner'::public.user_role, 'admin'::public.user_role])
  )
)
with check (
  tenant_id in (
    select tu.tenant_id
    from public.tenant_users tu
    join public.roles r on r.id = tu.role_id
    where tu.user_id = (select auth.uid())
      and tu.is_active = true
      and r.is_active = true
      and r.name = any (array['owner'::public.user_role, 'admin'::public.user_role])
      and tu.tenant_id = cancellation_categories.tenant_id
  )
);

create policy cancellation_categories_tenant_delete
on public.cancellation_categories
for delete
to public
using (
  tenant_id in (
    select tu.tenant_id
    from public.tenant_users tu
    join public.roles r on r.id = tu.role_id
    where tu.user_id = (select auth.uid())
      and tu.is_active = true
      and r.is_active = true
      and r.name = any (array['owner'::public.user_role, 'admin'::public.user_role])
  )
);

commit;
