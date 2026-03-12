begin;

alter table public.tenant_settings
  add column if not exists created_at timestamptz not null default now();

commit;
