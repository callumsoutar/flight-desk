-- Remove legacy aircraft_ttis_rollup view. Reconciliation and get_aircraft_tech_log use
-- aircraft.initial_total_time_in_service and the bookings ledger directly (see 20260417140000).
-- This object was a VIEW (not a table); DROP VIEW is correct.

drop view if exists public.aircraft_ttis_rollup;
