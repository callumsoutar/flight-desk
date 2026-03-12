begin;

create index if not exists idx_tenant_settings_updated_by
  on public.tenant_settings (updated_by)
  where updated_by is not null;

commit;
