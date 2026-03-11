-- Simplified tax model: app tax rates are source of truth.
-- Xero tax-rate sync table is no longer used.
DROP TABLE IF EXISTS public.xero_tax_rates;
