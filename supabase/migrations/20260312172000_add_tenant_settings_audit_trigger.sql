begin;

create or replace function public.log_tenant_settings_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (old.settings is distinct from new.settings) then
    insert into public.tenant_settings_audit (
      tenant_id,
      changed_by,
      previous_settings,
      new_settings,
      changed_at
    )
    values (
      new.tenant_id,
      coalesce(new.updated_by, auth.uid()),
      coalesce(old.settings, '{}'::jsonb),
      coalesce(new.settings, '{}'::jsonb),
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_tenant_settings_audit on public.tenant_settings;
create trigger trigger_tenant_settings_audit
after update on public.tenant_settings
for each row
execute function public.log_tenant_settings_audit();

commit;
