ALTER TABLE public.chargeable_types
  ADD COLUMN IF NOT EXISTS gl_code text;

COMMENT ON COLUMN public.chargeable_types.gl_code IS
  'Default GL code for all chargeables of this type when creating invoice items.';

ALTER TABLE public.flight_types
  ADD COLUMN IF NOT EXISTS aircraft_gl_code text,
  ADD COLUMN IF NOT EXISTS instructor_gl_code text;

COMMENT ON COLUMN public.flight_types.aircraft_gl_code IS
  'GL code used for generated aircraft hire line items for this flight type.';
COMMENT ON COLUMN public.flight_types.instructor_gl_code IS
  'GL code used for generated instructor line items for this flight type (not required for solo).';
