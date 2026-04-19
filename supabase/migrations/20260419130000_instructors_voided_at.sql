-- Soft-delete: instructors remain for history/audit but are excluded from active lists and booking options.
alter table public.instructors
  add column if not exists voided_at timestamptz;

comment on column public.instructors.voided_at is
  'When set, the instructor is voided (soft-deleted): hidden from instructor lists and scheduling; related historical records remain.';

create index if not exists instructors_tenant_active_idx
  on public.instructors (tenant_id)
  where voided_at is null;
