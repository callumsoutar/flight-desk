alter table public.flight_types
  add column if not exists is_revenue boolean not null default true;

comment on column public.flight_types.is_revenue is
  'When true, flying booked under this flight type counts as revenue for reporting.';
