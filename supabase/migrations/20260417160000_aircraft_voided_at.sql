-- Soft-delete: aircraft remain in the database for history/audit but are excluded from active fleet UX.
alter table public.aircraft
  add column if not exists voided_at timestamptz;

comment on column public.aircraft.voided_at is
  'When set, the aircraft is voided (soft-deleted): hidden from scheduling and fleet lists; related historical records remain.';

create index if not exists aircraft_tenant_active_idx
  on public.aircraft (tenant_id)
  where voided_at is null;
