-- Chargeable types v2: replace is_global/is_system with scope + system_key
-- Goals:
-- - Tenant-owned chargeable types are fully manageable by tenant admins/owners.
-- - System chargeable types are global, always exist, readable by all, and immutable.
-- - No reliance on the old is_global flag.

begin;

-- 1) New scope enum + columns
do $$
begin
  if not exists (select 1 from pg_type where typname = 'chargeable_type_scope') then
    create type public.chargeable_type_scope as enum ('tenant', 'system');
  end if;
end $$;

alter table public.chargeable_types
  add column if not exists scope public.chargeable_type_scope,
  add column if not exists system_key text;

-- Drop legacy constraint before inserting system rows (it requires is_global=true when tenant_id is null).
alter table public.chargeable_types
  drop constraint if exists chargeable_types_global_no_tenant;

-- Backfill scope from legacy flags (safe even if no global rows exist).
update public.chargeable_types
set scope = case when is_global then 'system'::public.chargeable_type_scope else 'tenant'::public.chargeable_type_scope end
where scope is null;

alter table public.chargeable_types
  alter column scope set not null;

-- 2) Ensure only system rows have system_key, and system rows are tenant_id null.
-- (We’ll add a strict constraint after we’ve migrated data.)
update public.chargeable_types
set tenant_id = null
where scope = 'system'::public.chargeable_type_scope;

-- 3) Seed/ensure required system chargeable types exist.
-- Note: do not hardcode IDs.
insert into public.chargeable_types (code, name, description, gl_code, is_active, scope, system_key, tenant_id)
select
  seeded.code,
  seeded.name,
  seeded.description,
  null::text as gl_code,
  true as is_active,
  'system'::public.chargeable_type_scope as scope,
  seeded.system_key,
  null::uuid as tenant_id
from (
  values
    ('landing_fees', 'Landing fees', 'System chargeable type for landing fees.', 'landing_fees'),
    ('airways_fees', 'Airways fees', 'System chargeable type for airways fees.', 'airways_fees')
) as seeded(code, name, description, system_key)
where not exists (
  select 1
  from public.chargeable_types ct
  where ct.scope = 'system'::public.chargeable_type_scope
    and ct.system_key = seeded.system_key
);

-- 4) Migrate existing tenant chargeable type codes (legacy singular) to system types.
-- If a tenant has tenant-scoped 'landing_fee'/'airways_fee', move any chargeables to the new system type
-- and remove the tenant-scoped type.
-- Disable audit trigger during migration (auth.uid() is null in migration context, breaks audit_logs.tenant_id).
alter table public.chargeables disable trigger chargeables_audit_trigger;

do $$
declare
  landing_system_id uuid;
  airways_system_id uuid;
begin
  select id into landing_system_id
  from public.chargeable_types
  where scope = 'system'::public.chargeable_type_scope and system_key = 'landing_fees'
  limit 1;

  select id into airways_system_id
  from public.chargeable_types
  where scope = 'system'::public.chargeable_type_scope and system_key = 'airways_fees'
  limit 1;

  if landing_system_id is not null then
    update public.chargeables c
    set chargeable_type_id = landing_system_id
    where c.chargeable_type_id in (
      select ct.id from public.chargeable_types ct
      where ct.scope = 'tenant'::public.chargeable_type_scope and ct.code = 'landing_fee'
    );

    delete from public.chargeable_types
    where scope = 'tenant'::public.chargeable_type_scope and code = 'landing_fee';
  end if;

  if airways_system_id is not null then
    update public.chargeables c
    set chargeable_type_id = airways_system_id
    where c.chargeable_type_id in (
      select ct.id from public.chargeable_types ct
      where ct.scope = 'tenant'::public.chargeable_type_scope and ct.code = 'airways_fee'
    );

    delete from public.chargeable_types
    where scope = 'tenant'::public.chargeable_type_scope and code = 'airways_fee';
  end if;
end $$;

alter table public.chargeables enable trigger chargeables_audit_trigger;

-- 5) Constraints + indexes
alter table public.chargeable_types
  add constraint chargeable_types_scope_tenant_id_consistency
  check (
    (scope = 'tenant'::public.chargeable_type_scope and tenant_id is not null and system_key is null)
    or
    (scope = 'system'::public.chargeable_type_scope and tenant_id is null and system_key in ('landing_fees','airways_fees'))
  );

-- Replace legacy uniqueness assumptions (was UNIQUE(code) across all rows).
alter table public.chargeable_types drop constraint if exists chargeable_types_code_key;
drop index if exists public.idx_chargeable_types_code_global;
drop index if exists public.idx_chargeable_types_code_per_tenant;

create unique index if not exists idx_chargeable_types_code_per_tenant
  on public.chargeable_types (tenant_id, code)
  where (scope = 'tenant'::public.chargeable_type_scope);

create unique index if not exists idx_chargeable_types_system_key
  on public.chargeable_types (system_key)
  where (scope = 'system'::public.chargeable_type_scope);

create unique index if not exists idx_chargeable_types_code_system
  on public.chargeable_types (code)
  where (scope = 'system'::public.chargeable_type_scope);

-- 6) Immutability guardrails for system rows (DB-level, not just RLS).
create or replace function public.guard_system_chargeable_types()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.scope = 'system'::public.chargeable_type_scope then
      raise exception 'System chargeable types cannot be deleted';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.scope = 'system'::public.chargeable_type_scope then
      -- Allow service_role to update if necessary; block all normal users.
      if auth.role() <> 'service_role' then
        raise exception 'System chargeable types cannot be modified';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_system_chargeable_types on public.chargeable_types;
create trigger trg_guard_system_chargeable_types
before update or delete on public.chargeable_types
for each row
execute function public.guard_system_chargeable_types();

-- 7) RLS policies (replace legacy hybrid policies based on is_global)
alter table public.chargeable_types enable row level security;

drop policy if exists chargeable_types_hybrid_select on public.chargeable_types;
drop policy if exists chargeable_types_hybrid_insert on public.chargeable_types;
drop policy if exists chargeable_types_hybrid_update on public.chargeable_types;
drop policy if exists chargeable_types_hybrid_delete on public.chargeable_types;

create policy chargeable_types_select
on public.chargeable_types
for select
to public
using (
  scope = 'system'::public.chargeable_type_scope
  or tenant_id in (
    select tu.tenant_id
    from public.tenant_users tu
    where tu.user_id = auth.uid()
      and tu.is_active = true
  )
);

create policy chargeable_types_insert
on public.chargeable_types
for insert
to public
with check (
  scope = 'tenant'::public.chargeable_type_scope
  and tenant_id in (
    select tu.tenant_id
    from public.tenant_users tu
    join public.roles r on r.id = tu.role_id
    where tu.user_id = auth.uid()
      and tu.is_active = true
      and r.is_active = true
      and r.name = any (array['owner'::public.user_role, 'admin'::public.user_role])
  )
);

create policy chargeable_types_update
on public.chargeable_types
for update
to public
using (
  scope = 'tenant'::public.chargeable_type_scope
  and tenant_id in (
    select tu.tenant_id
    from public.tenant_users tu
    join public.roles r on r.id = tu.role_id
    where tu.user_id = auth.uid()
      and tu.is_active = true
      and r.is_active = true
      and r.name = any (array['owner'::public.user_role, 'admin'::public.user_role])
  )
)
with check (
  scope = 'tenant'::public.chargeable_type_scope
  and tenant_id in (
    select tu.tenant_id
    from public.tenant_users tu
    join public.roles r on r.id = tu.role_id
    where tu.user_id = auth.uid()
      and tu.is_active = true
      and r.is_active = true
      and r.name = any (array['owner'::public.user_role, 'admin'::public.user_role])
  )
);

create policy chargeable_types_delete
on public.chargeable_types
for delete
to public
using (
  scope = 'tenant'::public.chargeable_type_scope
  and tenant_id in (
    select tu.tenant_id
    from public.tenant_users tu
    join public.roles r on r.id = tu.role_id
    where tu.user_id = auth.uid()
      and tu.is_active = true
      and r.is_active = true
      and r.name = 'owner'::public.user_role
  )
);

-- 8) Remove legacy columns
alter table public.chargeable_types
  drop column if exists is_global,
  drop column if exists is_system;

commit;

