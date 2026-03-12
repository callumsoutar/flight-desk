-- Security remediation migration based on audit findings.
-- Applies defense-in-depth fixes for tenant isolation, RLS policy hardening,
-- function search_path hardening, and view execution context.

BEGIN;

-- ---------------------------------------------------------------------------
-- D1: Fix cancel_booking / uncancel_booking tenant isolation and search_path.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid,
  p_cancellation_category_id uuid DEFAULT NULL::uuid,
  p_reason text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid;
  v_booking_id uuid;
  v_current_status public.booking_status;
  v_tenant_id uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT b.id, b.status, b.tenant_id
  INTO v_booking_id, v_current_status, v_tenant_id
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF NOT public.user_belongs_to_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_current_status = 'cancelled'::public.booking_status THEN
    RAISE EXCEPTION 'Booking is already cancelled';
  END IF;

  IF v_current_status = 'complete'::public.booking_status THEN
    RAISE EXCEPTION 'Cannot cancel completed booking';
  END IF;

  UPDATE public.bookings
  SET
    status = 'cancelled'::public.booking_status,
    cancellation_category_id = p_cancellation_category_id,
    cancellation_reason = p_reason,
    cancelled_by = v_actor,
    cancelled_notes = p_notes,
    cancelled_at = now(),
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN p_booking_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uncancel_booking(p_booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_booking_id uuid;
  v_current_status public.booking_status;
  v_tenant_id uuid;
BEGIN
  SELECT b.id, b.status, b.tenant_id
  INTO v_booking_id, v_current_status, v_tenant_id
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF NOT public.user_belongs_to_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_current_status <> 'cancelled'::public.booking_status THEN
    RAISE EXCEPTION 'Booking is not cancelled';
  END IF;

  UPDATE public.bookings
  SET
    status = 'confirmed'::public.booking_status,
    cancellation_category_id = NULL,
    cancellation_reason = NULL,
    cancelled_by = NULL,
    cancelled_notes = NULL,
    cancelled_at = NULL,
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN p_booking_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- D2: Remove duplicate weak policies and harden remaining policies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized roles can create aircraft" ON public.aircraft;
DROP POLICY IF EXISTS "Authorized roles can update aircraft" ON public.aircraft;
DROP POLICY IF EXISTS "Owners and admins can delete aircraft" ON public.aircraft;

DROP POLICY IF EXISTS aircraft_tenant_insert ON public.aircraft;
CREATE POLICY aircraft_tenant_insert
ON public.aircraft
FOR INSERT
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

DROP POLICY IF EXISTS aircraft_tenant_update ON public.aircraft;
CREATE POLICY aircraft_tenant_update
ON public.aircraft
FOR UPDATE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
)
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

DROP POLICY IF EXISTS aircraft_tenant_delete ON public.aircraft;
CREATE POLICY aircraft_tenant_delete
ON public.aircraft
FOR DELETE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);

DROP POLICY IF EXISTS "Authorized roles can create instructors" ON public.instructors;
DROP POLICY IF EXISTS "Authorized roles can update instructors" ON public.instructors;
DROP POLICY IF EXISTS "Owners and admins can delete instructors" ON public.instructors;

DROP POLICY IF EXISTS instructors_tenant_insert ON public.instructors;
CREATE POLICY instructors_tenant_insert
ON public.instructors
FOR INSERT
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

DROP POLICY IF EXISTS instructors_tenant_update ON public.instructors;
CREATE POLICY instructors_tenant_update
ON public.instructors
FOR UPDATE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
)
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

DROP POLICY IF EXISTS instructors_tenant_delete ON public.instructors;
CREATE POLICY instructors_tenant_delete
ON public.instructors
FOR DELETE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);

DROP POLICY IF EXISTS "Authorized roles can create roster rules" ON public.roster_rules;
DROP POLICY IF EXISTS "Authorized roles can update roster rules" ON public.roster_rules;
DROP POLICY IF EXISTS "Owners and admins can delete roster rules" ON public.roster_rules;

-- ---------------------------------------------------------------------------
-- D3 + H1/H2: Harden bookings insert/delete.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS bookings_tenant_insert ON public.bookings;
CREATE POLICY bookings_tenant_insert
ON public.bookings
FOR INSERT
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND (
    user_id = auth.uid()
    OR public.tenant_user_has_role(
      auth.uid(),
      tenant_id,
      ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
    )
  )
);

DROP POLICY IF EXISTS bookings_tenant_delete ON public.bookings;
CREATE POLICY bookings_tenant_delete
ON public.bookings
FOR DELETE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- D4: Restrict permissive CRUD tables to owner/admin for writes.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS flight_types_tenant_all ON public.flight_types;
CREATE POLICY flight_types_tenant_select
ON public.flight_types
FOR SELECT
USING (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY flight_types_tenant_insert
ON public.flight_types
FOR INSERT
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);
CREATE POLICY flight_types_tenant_update
ON public.flight_types
FOR UPDATE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
)
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);
CREATE POLICY flight_types_tenant_delete
ON public.flight_types
FOR DELETE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);

DROP POLICY IF EXISTS lessons_tenant_all ON public.lessons;
CREATE POLICY lessons_tenant_select
ON public.lessons
FOR SELECT
USING (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY lessons_tenant_insert
ON public.lessons
FOR INSERT
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);
CREATE POLICY lessons_tenant_update
ON public.lessons
FOR UPDATE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
)
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);
CREATE POLICY lessons_tenant_delete
ON public.lessons
FOR DELETE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);

DROP POLICY IF EXISTS experience_types_tenant_all ON public.experience_types;
CREATE POLICY experience_types_tenant_select
ON public.experience_types
FOR SELECT
USING (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY experience_types_tenant_insert
ON public.experience_types
FOR INSERT
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);
CREATE POLICY experience_types_tenant_update
ON public.experience_types
FOR UPDATE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
)
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);
CREATE POLICY experience_types_tenant_delete
ON public.experience_types
FOR DELETE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);

DROP POLICY IF EXISTS membership_types_tenant_all ON public.membership_types;
CREATE POLICY membership_types_tenant_select
ON public.membership_types
FOR SELECT
USING (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY membership_types_tenant_insert
ON public.membership_types
FOR INSERT
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);
CREATE POLICY membership_types_tenant_update
ON public.membership_types
FOR UPDATE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
)
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);
CREATE POLICY membership_types_tenant_delete
ON public.membership_types
FOR DELETE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);

DROP POLICY IF EXISTS memberships_tenant_all ON public.memberships;
CREATE POLICY memberships_tenant_select
ON public.memberships
FOR SELECT
USING (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY memberships_tenant_insert
ON public.memberships
FOR INSERT
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);
CREATE POLICY memberships_tenant_update
ON public.memberships
FOR UPDATE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
)
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);
CREATE POLICY memberships_tenant_delete
ON public.memberships
FOR DELETE
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- D10 + D11: Tighten audit_logs and tax_rate_templates policies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_tenant_insert ON public.audit_logs;
CREATE POLICY audit_logs_tenant_insert
ON public.audit_logs
FOR INSERT
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

DROP POLICY IF EXISTS tax_rate_templates_select ON public.tax_rate_templates;
CREATE POLICY tax_rate_templates_select
ON public.tax_rate_templates
FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- D5 + M7: Tenant-scope permission override management.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_role_simple(
  user_id uuid,
  p_tenant_id uuid,
  allowed_roles public.user_role[]
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    JOIN public.roles r ON tu.role_id = r.id
    WHERE tu.user_id = check_user_role_simple.user_id
      AND tu.tenant_id = p_tenant_id
      AND tu.is_active = true
      AND r.is_active = true
      AND r.name = ANY (allowed_roles)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$function$;

ALTER TABLE public.user_permission_overrides
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.user_permission_overrides upo
SET tenant_id = public.get_user_tenant(upo.user_id)
WHERE upo.tenant_id IS NULL;

ALTER TABLE public.user_permission_overrides
  ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_permission_overrides_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.user_permission_overrides
      ADD CONSTRAINT user_permission_overrides_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_permission_overrides_tenant_user_permission_idx
  ON public.user_permission_overrides (tenant_id, user_id, permission_id);

DROP POLICY IF EXISTS roles_manage ON public.roles;
CREATE POLICY roles_manage
ON public.roles
FOR ALL
USING (
  public.tenant_user_has_role(
    auth.uid(),
    public.get_user_tenant(auth.uid()),
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
)
WITH CHECK (
  public.tenant_user_has_role(
    auth.uid(),
    public.get_user_tenant(auth.uid()),
    ARRAY['owner'::public.user_role, 'admin'::public.user_role]
  )
);

DROP POLICY IF EXISTS user_permission_overrides_manage ON public.user_permission_overrides;
CREATE POLICY user_permission_overrides_manage
ON public.user_permission_overrides
FOR ALL
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['admin'::public.user_role, 'owner'::public.user_role]
  )
)
WITH CHECK (
  public.user_belongs_to_tenant(tenant_id)
  AND public.tenant_user_has_role(
    auth.uid(),
    tenant_id,
    ARRAY['admin'::public.user_role, 'owner'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- D6: Tenant-scoped staff helper and users_insert policy update.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_is_staff_for_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    JOIN public.roles r ON tu.role_id = r.id
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = p_tenant_id
      AND tu.is_active = true
      AND r.is_active = true
      AND r.name IN ('owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role)
  );
$function$;

CREATE OR REPLACE FUNCTION public.current_user_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.current_user_is_staff_for_tenant(public.get_user_tenant(auth.uid()));
$function$;

DROP POLICY IF EXISTS users_insert ON public.users;
CREATE POLICY users_insert
ON public.users
FOR INSERT
WITH CHECK (
  (id = auth.uid())
  OR public.current_user_is_staff_for_tenant(public.get_user_tenant(auth.uid()))
);

-- ---------------------------------------------------------------------------
-- D7 + M1/M2: Fix mutable function search_path values.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.get_auth_user_details(uuid) SET search_path TO '';

ALTER FUNCTION public.calculate_applied_aircraft_delta(text, numeric, numeric) SET search_path TO 'public';
ALTER FUNCTION public.calculate_flight_time() SET search_path TO 'public';
ALTER FUNCTION public.check_schedule_conflict(uuid, date, time without time zone, time without time zone, uuid, uuid) SET search_path TO 'public';
ALTER FUNCTION public.equipment_update_summary() SET search_path TO 'public';
ALTER FUNCTION public.get_account_balance(uuid) SET search_path TO 'public';
ALTER FUNCTION public.get_aircraft_maintenance_cost_report(uuid, timestamp with time zone, timestamp with time zone) SET search_path TO 'public';
ALTER FUNCTION public.get_aircraft_maintenance_cost_report(uuid, date, date) SET search_path TO 'public';
ALTER FUNCTION public.get_component_timing_report(uuid, timestamp with time zone, timestamp with time zone) SET search_path TO 'public';
ALTER FUNCTION public.get_instructor_activity_reports(uuid, date, date) SET search_path TO 'public';
ALTER FUNCTION public.get_instructor_week_schedule(uuid, date) SET search_path TO 'public';
ALTER FUNCTION public.get_maintenance_frequency_report(uuid, timestamp with time zone, timestamp with time zone) SET search_path TO 'public';
ALTER FUNCTION public.get_tech_log_reports(uuid, date, date) SET search_path TO 'public';
ALTER FUNCTION public.guard_system_chargeable_types() SET search_path TO 'public';
ALTER FUNCTION public.log_booking_audit() SET search_path TO 'public';
ALTER FUNCTION public.prevent_approved_checkin_mutations() SET search_path TO 'public';
ALTER FUNCTION public.prevent_double_booking_on_bookings() SET search_path TO 'public';
ALTER FUNCTION public.set_lesson_progress_attempt() SET search_path TO 'public';
ALTER FUNCTION public.set_updated_at() SET search_path TO 'public';
ALTER FUNCTION public.update_observation_on_comment() SET search_path TO 'public';
ALTER FUNCTION public.validate_aircraft_ttis_update() SET search_path TO 'public';

-- ---------------------------------------------------------------------------
-- D8: Rebuild SECURITY DEFINER views as SECURITY INVOKER.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.aircraft_ttis_rollup
WITH (security_invoker = true)
AS
SELECT
  a.id AS aircraft_id,
  a.registration,
  a.total_time_method,
  a.total_time_in_service AS stored_ttis,
  COALESCE(a.initial_total_time_in_service, 0::numeric) AS initial_ttis,
  COALESCE(s.ledger_sum, 0::numeric) AS ledger_delta_sum,
  COALESCE(a.initial_total_time_in_service, 0::numeric) + COALESCE(s.ledger_sum, 0::numeric) AS computed_ttis,
  a.total_time_in_service - (COALESCE(a.initial_total_time_in_service, 0::numeric) + COALESCE(s.ledger_sum, 0::numeric)) AS discrepancy,
  COALESCE(s.flight_count, 0::bigint) AS flight_count,
  a.current_hobbs,
  a.current_tach,
  a.tenant_id
FROM public.aircraft a
LEFT JOIN (
  SELECT
    b.checked_out_aircraft_id AS aircraft_id,
    sum(b.applied_aircraft_delta) AS ledger_sum,
    count(*) AS flight_count
  FROM public.bookings b
  WHERE
    b.checkin_approved_at IS NOT NULL
    AND b.applied_aircraft_delta IS NOT NULL
    AND b.status = 'complete'::public.booking_status
    AND b.checked_out_aircraft_id IS NOT NULL
  GROUP BY b.checked_out_aircraft_id
) s ON s.aircraft_id = a.id;

CREATE OR REPLACE VIEW public.invoice_effective_status
WITH (security_invoker = true)
AS
SELECT
  id,
  invoice_number,
  user_id,
  status,
  issue_date,
  due_date,
  paid_date,
  subtotal,
  tax_total,
  total_amount,
  total_paid,
  balance_due,
  notes,
  created_at,
  updated_at,
  booking_id,
  reference,
  payment_method,
  payment_reference,
  tax_rate,
  deleted_at,
  deleted_by,
  deletion_reason,
  tenant_id,
  CASE
    WHEN status = 'authorised'::public.invoice_status AND due_date < now()
      THEN 'overdue'::public.invoice_status
    ELSE status
  END AS effective_status
FROM public.invoices;

-- ---------------------------------------------------------------------------
-- D9: Fix process_refund to use invoice_payments and explicit authz guard.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_refund(
  p_payment_id uuid,
  p_amount numeric,
  p_notes text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid;
  v_payment public.invoice_payments%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_refund_tx_id uuid;
  v_new_total_paid numeric;
  v_new_balance_due numeric;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be greater than zero';
  END IF;

  SELECT *
  INTO v_payment
  FROM public.invoice_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;

  IF NOT public.tenant_user_has_role(
    v_actor,
    v_payment.tenant_id,
    ARRAY['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_amount > v_payment.amount THEN
    RAISE EXCEPTION 'Refund amount cannot exceed payment amount';
  END IF;

  SELECT *
  INTO v_invoice
  FROM public.invoices
  WHERE id = v_payment.invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found for payment: %', p_payment_id;
  END IF;

  INSERT INTO public.transactions (
    user_id,
    type,
    status,
    amount,
    description,
    metadata,
    reference_number,
    completed_at,
    tenant_id,
    invoice_id
  )
  VALUES (
    v_payment.user_id,
    'refund'::public.transaction_type,
    'completed'::public.transaction_status,
    -p_amount,
    'Refund for payment: ' || COALESCE(v_payment.payment_reference, p_payment_id::text),
    jsonb_build_object(
      'invoice_id', v_payment.invoice_id,
      'original_payment_id', p_payment_id,
      'refund_notes', p_notes,
      'refunded_by', v_actor
    ),
    'REFUND-' || p_payment_id::text || '-' || replace(substr(gen_random_uuid()::text, 1, 8), '-', ''),
    now(),
    v_payment.tenant_id,
    v_payment.invoice_id
  )
  RETURNING id INTO v_refund_tx_id;

  v_new_total_paid := GREATEST(0, round(COALESCE(v_invoice.total_paid, 0) - p_amount, 2));
  v_new_balance_due := round(COALESCE(v_invoice.total_amount, 0) - v_new_total_paid, 2);

  UPDATE public.invoices
  SET
    total_paid = v_new_total_paid,
    balance_due = v_new_balance_due,
    status = CASE
      WHEN v_new_balance_due > 0 AND due_date < now() THEN 'overdue'::public.invoice_status
      WHEN v_new_balance_due > 0 THEN 'authorised'::public.invoice_status
      ELSE status
    END,
    paid_date = CASE
      WHEN v_new_balance_due > 0 THEN NULL
      ELSE paid_date
    END,
    updated_at = now()
  WHERE id = v_payment.invoice_id;

  RETURN v_refund_tx_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- L2: Move pg_net extension out of public schema.
-- NOTE: this managed pg_net build does not support ALTER EXTENSION ... SET SCHEMA.
-- Keep as a warning for manual remediation if/when extension supports it.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_net'
      AND n.nspname = 'public'
  ) THEN
    RAISE NOTICE 'pg_net is installed in public schema; this build does not support SET SCHEMA, manual provider-side remediation required.';
  END IF;
END $$;

COMMIT;
