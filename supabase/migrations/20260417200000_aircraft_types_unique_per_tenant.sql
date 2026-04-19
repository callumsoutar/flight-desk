-- Names should be unique per tenant, not globally (multi-tenant isolation).
alter table public.aircraft_types
  drop constraint if exists aircraft_types_name_key;

alter table public.aircraft_types
  add constraint aircraft_types_tenant_id_name_key unique (tenant_id, name);
