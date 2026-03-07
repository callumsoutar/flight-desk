-- Delete all data for tenant_id = eee977c1-af34-4153-949c-3b0c15c1cb8b
-- Run this in Supabase SQL Editor. Order respects foreign keys (children before parents).

DO $$
DECLARE
  target_tenant_id uuid := 'eee977c1-af34-4153-949c-3b0c15c1cb8b';
BEGIN
  -- Disable audit trigger on bookings so DELETE does not insert into audit_logs (tenant_id would be null)
  ALTER TABLE public.bookings DISABLE TRIGGER bookings_audit_trigger;

  -- Layer 1: Tables that reference invoices, bookings, aircraft, etc.
  DELETE FROM public.email_logs WHERE tenant_id = target_tenant_id;
  DELETE FROM public.invoice_payments WHERE tenant_id = target_tenant_id;
  DELETE FROM public.invoice_items WHERE tenant_id = target_tenant_id;
  DELETE FROM public.flight_experience WHERE tenant_id = target_tenant_id;
  DELETE FROM public.lesson_progress WHERE tenant_id = target_tenant_id;
  DELETE FROM public.exam_results WHERE tenant_id = target_tenant_id;
  DELETE FROM public.equipment_issuance WHERE tenant_id = target_tenant_id;
  DELETE FROM public.equipment_updates WHERE tenant_id = target_tenant_id;
  DELETE FROM public.maintenance_visits WHERE tenant_id = target_tenant_id;
  DELETE FROM public.observations WHERE tenant_id = target_tenant_id;
  DELETE FROM public.aircraft_charge_rates WHERE tenant_id = target_tenant_id;
  DELETE FROM public.aircraft_components WHERE tenant_id = target_tenant_id;
  DELETE FROM public.landing_fee_rates WHERE tenant_id = target_tenant_id;
  DELETE FROM public.instructor_flight_type_rates WHERE tenant_id = target_tenant_id;
  DELETE FROM public.memberships WHERE tenant_id = target_tenant_id;

  -- Layer 2: Invoices and bookings
  DELETE FROM public.invoices WHERE tenant_id = target_tenant_id;
  DELETE FROM public.bookings WHERE tenant_id = target_tenant_id;

  -- Layer 3: Dependent on syllabus, aircraft, equipment, instructors
  DELETE FROM public.student_syllabus_enrollment WHERE tenant_id = target_tenant_id;
  DELETE FROM public.exam WHERE tenant_id = target_tenant_id;
  DELETE FROM public.lessons WHERE tenant_id = target_tenant_id;
  DELETE FROM public.aircraft WHERE tenant_id = target_tenant_id;
  DELETE FROM public.equipment WHERE tenant_id = target_tenant_id;
  DELETE FROM public.instructors WHERE tenant_id = target_tenant_id;

  -- Layer 4: Syllabus, aircraft_types, chargeables, membership_types
  DELETE FROM public.syllabus WHERE tenant_id = target_tenant_id;
  DELETE FROM public.aircraft_types WHERE tenant_id = target_tenant_id;
  DELETE FROM public.chargeables WHERE tenant_id = target_tenant_id;
  DELETE FROM public.membership_types WHERE tenant_id = target_tenant_id;

  -- Layer 5: Categories and types
  DELETE FROM public.cancellation_categories WHERE tenant_id = target_tenant_id;
  DELETE FROM public.chargeable_types WHERE tenant_id = target_tenant_id;
  DELETE FROM public.flight_types WHERE tenant_id = target_tenant_id;
  DELETE FROM public.experience_types WHERE tenant_id = target_tenant_id;

  -- Layer 6: Tenant-scoped config and logs
  DELETE FROM public.roster_rules WHERE tenant_id = target_tenant_id;
  DELETE FROM public.shift_overrides WHERE tenant_id = target_tenant_id;
  DELETE FROM public.tax_rates WHERE tenant_id = target_tenant_id;
  DELETE FROM public.audit_logs WHERE tenant_id = target_tenant_id;
  DELETE FROM public.invoice_sequences WHERE tenant_id = target_tenant_id;
  DELETE FROM public.tenant_settings WHERE tenant_id = target_tenant_id;
  DELETE FROM public.tenant_users WHERE tenant_id = target_tenant_id;
  DELETE FROM public.transactions WHERE tenant_id = target_tenant_id;
  DELETE FROM public.users_endorsements WHERE tenant_id = target_tenant_id;

  -- Layer 7: The tenant row itself
  DELETE FROM public.tenants WHERE id = target_tenant_id;

  -- Re-enable audit trigger
  ALTER TABLE public.bookings ENABLE TRIGGER bookings_audit_trigger;

  RAISE NOTICE 'Deleted all data for tenant %', target_tenant_id;
END $$;
