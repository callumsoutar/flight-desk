-- Performance advisor: unindexed_foreign_keys
-- flight_types.tenant_id FK lacked a covering index
CREATE INDEX IF NOT EXISTS idx_flight_types_tenant_id ON public.flight_types (tenant_id);
