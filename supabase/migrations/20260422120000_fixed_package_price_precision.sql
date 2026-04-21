-- Fixed-package ex-GST amounts are often derived from a tax-inclusive headline (e.g. $240.00).
-- Storing only 2 decimal places collapses 240/1.15 ≈ 208.695652… to 208.70, and invoice math
-- then rounds 208.70 × 1.15 to $240.01. Widen precision so UI roundToStoragePrecision (6dp)
-- survives the round-trip.

ALTER TABLE public.flight_types
  ALTER COLUMN fixed_package_price TYPE numeric(14, 6);

ALTER TABLE public.aircraft_charge_rates
  ALTER COLUMN fixed_package_price TYPE numeric(14, 6);

COMMENT ON COLUMN public.flight_types.fixed_package_price IS
  'Fixed package price excluding GST for billing_mode=fixed_package. Use fractional precision so values derived from a tax-inclusive headline (inclusive / (1+GST)) round-trip to the intended inclusive invoice line total.';

-- After this migration, open Settings → Flight types for each fixed-package type and save once
-- (or PATCH the flight type) so ex-GST is re-stored from the tax-inclusive headline at full precision.
