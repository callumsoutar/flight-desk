begin;

alter table public.tenant_settings enable row level security;

drop policy if exists tenant_settings_insert on public.tenant_settings;
drop policy if exists tenant_settings_update on public.tenant_settings;
drop policy if exists tenant_settings_delete on public.tenant_settings;

create policy tenant_settings_insert
on public.tenant_settings
for insert
to public
with check (
  public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
);

create policy tenant_settings_update
on public.tenant_settings
for update
to public
using (
  public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
)
with check (
  public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
);

create policy tenant_settings_delete
on public.tenant_settings
for delete
to public
using (
  public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
);

commit;
