-- Single package price (ex GST) for trial / fixed-package flight types.
-- Previously this lived only on aircraft_charge_rates (per aircraft × flight type).

ALTER TABLE public.flight_types
  ADD COLUMN IF NOT EXISTS fixed_package_price numeric(12, 2);

COMMENT ON COLUMN public.flight_types.fixed_package_price IS
  'Fixed package price excluding GST for billing_mode=fixed_package (typically trial). When set, this is the authoritative price; aircraft_charge_rates.fixed_package_price for this flight type is legacy/fallback.';

-- Backfill from existing per-aircraft rows (use minimum positive price where multiple aircraft differed).
UPDATE public.flight_types ft
SET fixed_package_price = sub.min_price
FROM (
  SELECT acr.flight_type_id,
    MIN((acr.fixed_package_price)::numeric) AS min_price
  FROM public.aircraft_charge_rates acr
  INNER JOIN public.flight_types f ON f.id = acr.flight_type_id
  WHERE f.billing_mode = 'fixed_package'
    AND acr.fixed_package_price IS NOT NULL
    AND (acr.fixed_package_price)::numeric > 0
  GROUP BY acr.flight_type_id
) sub
WHERE ft.id = sub.flight_type_id
  AND ft.billing_mode = 'fixed_package'
  AND ft.fixed_package_price IS NULL;
