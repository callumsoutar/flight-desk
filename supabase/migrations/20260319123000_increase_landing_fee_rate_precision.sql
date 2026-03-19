-- Preserve tax-inclusive round-trip accuracy for landing-fee overrides.
-- Default landing-fee rates are stored in chargeables.rate (already high precision),
-- but landing_fee_rates.rate was fixed to 2dp and caused 35.00 -> 34.99 drift.
alter table public.landing_fee_rates
  alter column rate type numeric(12,6)
  using rate::numeric(12,6);
