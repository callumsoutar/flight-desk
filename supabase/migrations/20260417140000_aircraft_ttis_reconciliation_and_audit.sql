-- Aircraft TTIS reconciliation, tech log, maintenance report overload, audit source labels,
-- and initial TTIS audit RPC.
-- aircraft_ttis_rollup: legacy view (when present); get_aircraft_tech_log no longer depends on it — initial TTIS comes from aircraft.initial_total_time_in_service only.

-- OUT/return row shape changes require DROP before CREATE; CREATE OR REPLACE cannot alter OUT params.
drop function if exists public.get_aircraft_tech_log(uuid, text, integer, integer);
drop function if exists public.recompute_aircraft_ttis_from_ledger(uuid);
drop function if exists public.find_aircraft_with_suspicious_ttis();

-- Tech log rows were bucketed by aircraft_ttis_audit.created_at (insert time). Check-ins approved
-- later can land on the wrong calendar day and merge multiple flights into one day. Use the booking's
-- flight end (and fallbacks) so each row rolls up to the local day the flight occurred.
create or replace function public.get_aircraft_tech_log(
  p_aircraft_id uuid,
  p_time_zone text default 'UTC',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  tech_log_date date,
  latest_reading numeric,
  daily_delta numeric,
  daily_ttis_delta numeric,
  computed_ttis numeric,
  reading_source text,
  total_time_method public.total_time_method,
  latest_entry_at timestamptz,
  entry_count integer,
  total_rows bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with current_aircraft as (
    select
      a.id,
      a.tenant_id,
      coalesce(a.initial_total_time_in_service, 0) as initial_ttis,
      a.total_time_method,
      case
        when a.total_time_method in ('tacho', 'tacho less 5%', 'tacho less 10%') then 'tacho'
        else 'hobbs'
      end as reading_source
    from public.aircraft a
    where a.id = p_aircraft_id
      and a.tenant_id = public.get_user_tenant(auth.uid())
  ),
  audit_rows as (
    select
      timezone(
        p_time_zone,
        coalesce(b.end_time, b.checkin_approved_at, audit.created_at)
      )::date as tech_log_date,
      audit.created_at,
      coalesce(b.end_time, b.checkin_approved_at, audit.created_at) as event_at,
      audit.id,
      case
        when aircraft.reading_source = 'tacho' then audit.new_tach
        else audit.new_hobbs
      end as selected_new_reading,
      case
        when aircraft.reading_source = 'tacho'
          and audit.old_tach is not null
          and audit.new_tach is not null
          then audit.new_tach - audit.old_tach
        when aircraft.reading_source = 'hobbs'
          and audit.old_hobbs is not null
          and audit.new_hobbs is not null
          then audit.new_hobbs - audit.old_hobbs
        else null
      end as selected_delta,
      case
        when audit.old_ttis is not null and audit.new_ttis is not null
          then audit.new_ttis - audit.old_ttis
        else null
      end as ttis_delta
    from public.aircraft_ttis_audit audit
    left join public.bookings b
      on b.id = audit.booking_id
     and b.tenant_id = audit.tenant_id
    join current_aircraft aircraft
      on aircraft.id = audit.aircraft_id
     and aircraft.tenant_id = audit.tenant_id
    where audit.aircraft_id = p_aircraft_id
      and audit.created_at is not null
  ),
  ranked_rows as (
    select
      *,
      row_number() over (
        partition by tech_log_date
        order by event_at desc nulls last, created_at desc, id desc
      ) as row_in_day
    from audit_rows
  ),
  daily_rollups as (
    select
      tech_log_date,
      max(selected_new_reading) filter (where row_in_day = 1) as latest_reading,
      sum(selected_delta) as daily_delta,
      sum(ttis_delta) as daily_ttis_delta,
      max(created_at) as latest_entry_at,
      count(*)::integer as entry_count
    from ranked_rows
    group by tech_log_date
  ),
  computed_rows as (
    select
      daily.tech_log_date,
      daily.latest_reading,
      daily.daily_delta,
      daily.daily_ttis_delta,
      aircraft.initial_ttis
        + sum(coalesce(daily.daily_ttis_delta, 0)) over (
          order by daily.tech_log_date asc
          rows between unbounded preceding and current row
        ) as computed_ttis,
      aircraft.reading_source,
      aircraft.total_time_method,
      daily.latest_entry_at,
      daily.entry_count
    from daily_rollups daily
    cross join current_aircraft aircraft
  )
  select
    rows.tech_log_date,
    rows.latest_reading,
    rows.daily_delta,
    rows.daily_ttis_delta,
    rows.computed_ttis,
    rows.reading_source,
    rows.total_time_method,
    rows.latest_entry_at,
    rows.entry_count,
    count(*) over () as total_rows
  from computed_rows rows
  order by rows.tech_log_date desc, rows.latest_entry_at desc
  limit greatest(coalesce(p_limit, 50), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;


create or replace function public.recompute_aircraft_ttis_from_ledger(p_aircraft_id uuid default null)
returns table (
  aircraft_id uuid,
  registration text,
  stored_ttis numeric,
  initial_ttis numeric,
  ledger_sum numeric,
  discrepancy numeric,
  flights_count bigint
)
language plpgsql
set search_path = public
as $function$
begin
  return query
  select
    a.id,
    a.registration,
    a.total_time_in_service as stored_ttis,
    coalesce(a.initial_total_time_in_service, 0)::numeric as initial_ttis,
    coalesce(s.ledger_sum, 0)::numeric as ledger_sum,
    (
      a.total_time_in_service
      - (coalesce(a.initial_total_time_in_service, 0) + coalesce(s.ledger_sum, 0))
    )::numeric as discrepancy,
    coalesce(s.cnt, 0)::bigint as flights_count
  from public.aircraft a
  left join (
    select
      b.checked_out_aircraft_id as aid,
      sum(b.applied_aircraft_delta) as ledger_sum,
      count(*)::bigint as cnt
    from public.bookings b
    where b.checkin_approved_at is not null
      and b.applied_aircraft_delta is not null
      and b.status = 'complete'::public.booking_status
      and b.checked_out_aircraft_id is not null
    group by b.checked_out_aircraft_id
  ) s on s.aid = a.id
  where (p_aircraft_id is null or a.id = p_aircraft_id);
end;
$function$;


create or replace function public.find_aircraft_with_suspicious_ttis()
returns table (
  aircraft_id uuid,
  registration text,
  total_time_in_service numeric,
  initial_ttis numeric,
  flights_count bigint,
  ledger_sum numeric,
  discrepancy numeric
)
language plpgsql
set search_path = public
as $function$
begin
  return query
  select
    a.id as aircraft_id,
    a.registration,
    a.total_time_in_service,
    coalesce(a.initial_total_time_in_service, 0)::numeric as initial_ttis,
    coalesce(s.cnt, 0)::bigint as flights_count,
    coalesce(s.ledger_sum, 0)::numeric as ledger_sum,
    (
      a.total_time_in_service
      - (coalesce(a.initial_total_time_in_service, 0) + coalesce(s.ledger_sum, 0))
    )::numeric as discrepancy
  from public.aircraft a
  left join (
    select
      b.checked_out_aircraft_id as aid,
      sum(b.applied_aircraft_delta) as ledger_sum,
      count(*) as cnt
    from public.bookings b
    where b.checkin_approved_at is not null
      and b.applied_aircraft_delta is not null
      and b.status = 'complete'
      and b.checked_out_aircraft_id is not null
    group by b.checked_out_aircraft_id
  ) s on s.aid = a.id
  where a.total_time_in_service is not null
    and (
      a.total_time_in_service < 10
      or abs(
        a.total_time_in_service
        - (coalesce(a.initial_total_time_in_service, 0) + coalesce(s.ledger_sum, 0))
      ) > 0.01
    )
  order by discrepancy asc nulls last;
end;
$function$;


drop function if exists public.get_aircraft_maintenance_cost_report(uuid, timestamp with time zone, timestamp with time zone);


create or replace function public.record_aircraft_initial_ttis_audit(p_aircraft_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_aircraft public.aircraft%rowtype;
begin
  if v_actor is null then
    raise exception 'Unauthorized';
  end if;

  v_tenant := public.get_user_tenant(v_actor);
  if v_tenant is null then
    raise exception 'Unauthorized';
  end if;

  if not public.user_belongs_to_tenant(v_tenant) then
    raise exception 'Forbidden';
  end if;

  if not public.tenant_user_has_role(
    v_actor,
    v_tenant,
    array[
      'owner'::public.user_role,
      'admin'::public.user_role,
      'instructor'::public.user_role
    ]
  ) then
    raise exception 'Forbidden';
  end if;

  select * into v_aircraft from public.aircraft where id = p_aircraft_id for share;
  if not found then
    raise exception 'Not found';
  end if;

  if v_aircraft.tenant_id is distinct from v_tenant then
    raise exception 'Forbidden';
  end if;

  insert into public.aircraft_ttis_audit (
    aircraft_id,
    user_id,
    old_ttis,
    new_ttis,
    old_tach,
    new_tach,
    old_hobbs,
    new_hobbs,
    source,
    tenant_id
  )
  values (
    v_aircraft.id,
    v_actor,
    null,
    v_aircraft.total_time_in_service,
    null,
    v_aircraft.current_tach,
    null,
    v_aircraft.current_hobbs,
    'initial',
    v_aircraft.tenant_id
  );
end;
$function$;

grant execute on function public.record_aircraft_initial_ttis_audit(uuid) to authenticated;


create or replace function public.handle_booking_delete_ttis_reversal()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_aircraft_id uuid;
  v_delta numeric;
  v_is_most_recent boolean;
begin
  if old.checkin_approved_at is null or old.applied_aircraft_delta is null then
    return old;
  end if;
  v_aircraft_id := old.checked_out_aircraft_id;
  if v_aircraft_id is null then
    return old;
  end if;
  v_delta := old.applied_aircraft_delta;
  select not exists (
    select 1 from bookings b
    where b.checked_out_aircraft_id = v_aircraft_id
      and b.checkin_approved_at is not null
      and b.id != old.id
      and (b.end_time > old.end_time or (b.end_time = old.end_time and b.checkin_approved_at > old.checkin_approved_at))
  ) into v_is_most_recent;
  perform pg_catalog.set_config('app.ttis_change_source', 'booking_delete_reversal', true);
  perform pg_catalog.set_config('app.bypass_aircraft_total_check', 'true', true);
  update aircraft
  set total_time_in_service = greatest(0, total_time_in_service - v_delta),
      current_tach = case when v_is_most_recent and old.tach_end is not null then old.tach_start else current_tach end,
      current_hobbs = case when v_is_most_recent and old.hobbs_end is not null then old.hobbs_start else current_hobbs end
  where id = v_aircraft_id;
  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION public.approve_booking_checkin_atomic(
  p_booking_id uuid,
  p_checked_out_aircraft_id uuid,
  p_checked_out_instructor_id uuid,
  p_flight_type_id uuid,
  p_hobbs_start numeric,
  p_hobbs_end numeric,
  p_tach_start numeric,
  p_tach_end numeric,
  p_airswitch_start numeric,
  p_airswitch_end numeric,
  p_solo_end_hobbs numeric,
  p_solo_end_tach numeric,
  p_dual_time numeric,
  p_solo_time numeric,
  p_billing_basis text,
  p_billing_hours numeric,
  p_tax_rate numeric DEFAULT NULL,
  p_due_date timestamptz DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid;
  v_tenant_id uuid;
  v_booking record;
  v_aircraft record;
  v_invoice_result jsonb;
  v_invoice_id uuid;
  v_invoice_number text;
  v_hobbs_delta numeric;
  v_tach_delta numeric;
  v_airswitch_delta numeric;
  v_method text;
  v_applied_delta numeric;
  v_old_ttis numeric;
  v_new_ttis numeric;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized', 'message', 'Authentication required');
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing invoice items', 'message', 'Check-in approval must include at least one invoice item');
    END IF;
    IF p_billing_basis IS NULL OR p_billing_basis NOT IN ('hobbs', 'tacho', 'airswitch') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid billing_basis', 'message', 'billing_basis must be one of hobbs, tacho, airswitch');
    END IF;
    IF p_billing_hours IS NULL OR p_billing_hours <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid billing_hours', 'message', 'billing_hours must be greater than zero');
    END IF;

    SELECT b.id, b.user_id, b.booking_type, b.status, b.checkin_approved_at, b.checked_in_at, b.tenant_id
    INTO v_booking
    FROM public.bookings b
    WHERE b.id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Booking not found');
    END IF;

    v_tenant_id := v_booking.tenant_id;
    IF v_tenant_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing tenant', 'message', 'Booking has no tenant');
    END IF;

    IF NOT public.user_belongs_to_tenant(v_tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Access denied');
    END IF;

    IF NOT public.check_user_role_simple(
      v_actor,
      v_tenant_id,
      ARRAY['admin'::public.user_role, 'owner'::public.user_role, 'instructor'::public.user_role]
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to approve check-in');
    END IF;

    IF v_booking.booking_type IS DISTINCT FROM 'flight' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid booking type', 'message', 'Check-in approval is only valid for flight bookings');
    END IF;
    IF v_booking.status = 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status', 'message', 'Cannot approve check-in for cancelled bookings');
    END IF;
    IF v_booking.checkin_approved_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already approved', 'message', 'Booking check-in has already been approved');
    END IF;
    IF v_booking.user_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing booking user', 'message', 'Cannot invoice a booking without a member/user_id');
    END IF;
    IF EXISTS (SELECT 1 FROM public.invoices i WHERE i.booking_id = p_booking_id AND i.deleted_at IS NULL) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice already exists', 'message', 'An active invoice already exists for this booking');
    END IF;

    SELECT a.id, a.total_time_method, a.total_time_in_service, a.tenant_id
    INTO v_aircraft
    FROM public.aircraft a
    WHERE a.id = p_checked_out_aircraft_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Aircraft not found');
    END IF;

    IF v_aircraft.tenant_id IS DISTINCT FROM v_tenant_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Aircraft does not belong to booking tenant');
    END IF;

    v_method := v_aircraft.total_time_method;
    IF v_method IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid aircraft total_time_method', 'message', 'Aircraft total_time_method must be set to apply TTIS deltas');
    END IF;

    v_hobbs_delta := CASE WHEN p_hobbs_start IS NULL OR p_hobbs_end IS NULL THEN NULL ELSE p_hobbs_end - p_hobbs_start END;
    v_tach_delta := CASE WHEN p_tach_start IS NULL OR p_tach_end IS NULL THEN NULL ELSE p_tach_end - p_tach_start END;
    v_airswitch_delta := CASE WHEN p_airswitch_start IS NULL OR p_airswitch_end IS NULL THEN NULL ELSE p_airswitch_end - p_airswitch_start END;

    IF v_hobbs_delta IS NOT NULL AND v_hobbs_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid hobbs delta', 'message', 'hobbs_end must be >= hobbs_start');
    END IF;
    IF v_tach_delta IS NOT NULL AND v_tach_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid tach delta', 'message', 'tach_end must be >= tach_start');
    END IF;
    IF v_airswitch_delta IS NOT NULL AND v_airswitch_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid airswitch delta', 'message', 'airswitch_end must be >= airswitch_start');
    END IF;

    v_applied_delta := public.calculate_applied_aircraft_delta(v_method, v_hobbs_delta, v_tach_delta);
    v_old_ttis := v_aircraft.total_time_in_service;
    v_new_ttis := v_old_ttis + v_applied_delta;

    IF v_applied_delta IS NULL OR v_applied_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid applied delta', 'message', 'Applied aircraft delta must be non-negative');
    END IF;

    v_invoice_result := public.create_invoice_atomic(v_booking.user_id, p_booking_id, 'authorised', NULL, p_tax_rate, now(), p_due_date, p_reference, p_notes, p_items);
    IF (v_invoice_result->>'success')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'Atomic invoice creation failed: %', COALESCE(v_invoice_result->>'error', 'unknown error');
    END IF;
    v_invoice_id := NULLIF(v_invoice_result->>'invoice_id', '')::uuid;
    v_invoice_number := v_invoice_result->>'invoice_number';
    IF v_invoice_id IS NULL THEN
      RAISE EXCEPTION 'Atomic invoice creation did not return invoice_id';
    END IF;

    PERFORM pg_catalog.set_config('app.ttis_change_source', 'checkin_approve', true);
    PERFORM pg_catalog.set_config('app.bypass_aircraft_total_check', 'true', true);
    UPDATE public.aircraft
    SET
      total_time_in_service = v_new_ttis,
      current_hobbs = COALESCE(p_hobbs_end, current_hobbs),
      current_tach = COALESCE(p_tach_end, current_tach)
    WHERE id = p_checked_out_aircraft_id
      AND tenant_id = v_tenant_id;

    UPDATE public.bookings
    SET
      status = 'complete',
      checked_out_aircraft_id = p_checked_out_aircraft_id,
      checked_out_instructor_id = p_checked_out_instructor_id,
      flight_type_id = p_flight_type_id,
      hobbs_start = p_hobbs_start,
      hobbs_end = p_hobbs_end,
      tach_start = p_tach_start,
      tach_end = p_tach_end,
      airswitch_start = p_airswitch_start,
      airswitch_end = p_airswitch_end,
      solo_end_hobbs = p_solo_end_hobbs,
      solo_end_tach = p_solo_end_tach,
      dual_time = p_dual_time,
      solo_time = p_solo_time,
      flight_time_hobbs = v_hobbs_delta,
      flight_time_tach = v_tach_delta,
      flight_time_airswitch = v_airswitch_delta,
      billing_basis = p_billing_basis,
      billing_hours = p_billing_hours,
      total_hours_start = v_old_ttis,
      total_hours_end = v_new_ttis,
      applied_aircraft_delta = v_applied_delta,
      applied_total_time_method = v_method,
      checkin_invoice_id = v_invoice_id,
      checkin_approved_at = now(),
      checkin_approved_by = v_actor,
      checked_in_at = COALESCE(v_booking.checked_in_at, now()),
      checked_in_by = v_actor
    WHERE id = p_booking_id
      AND tenant_id = v_tenant_id;

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'invoice_id', v_invoice_id,
      'invoice_number', v_invoice_number,
      'applied_aircraft_delta', v_applied_delta,
      'total_hours_start', v_old_ttis,
      'total_hours_end', v_new_ttis,
      'message', 'Booking check-in approved and TTIS updated atomically'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', SQLSTATE, 'message', 'Atomic check-in approval rolled back due to error');
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_booking_checkin_with_invoice_atomic(
  p_booking_id uuid,
  p_invoice_id uuid,
  p_checked_out_aircraft_id uuid,
  p_checked_out_instructor_id uuid,
  p_flight_type_id uuid,
  p_hobbs_start numeric,
  p_hobbs_end numeric,
  p_tach_start numeric,
  p_tach_end numeric,
  p_airswitch_start numeric,
  p_airswitch_end numeric,
  p_solo_end_hobbs numeric,
  p_solo_end_tach numeric,
  p_dual_time numeric,
  p_solo_time numeric,
  p_billing_basis text,
  p_billing_hours numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid;
  v_booking record;
  v_aircraft record;
  v_invoice record;
  v_tenant_id uuid;
  v_hobbs_delta numeric;
  v_tach_delta numeric;
  v_airswitch_delta numeric;
  v_method text;
  v_applied_delta numeric;
  v_old_ttis numeric;
  v_new_ttis numeric;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized', 'message', 'Authentication required');
    END IF;

    SELECT
      b.id,
      b.user_id,
      b.booking_type,
      b.status,
      b.checkin_approved_at,
      b.checked_in_at,
      b.tenant_id
    INTO v_booking
    FROM public.bookings b
    WHERE b.id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Booking not found');
    END IF;

    v_tenant_id := v_booking.tenant_id;

    IF NOT public.user_belongs_to_tenant(v_tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Access denied');
    END IF;

    IF NOT public.check_user_role_simple(
      v_actor,
      v_tenant_id,
      ARRAY[
        'admin'::public.user_role,
        'owner'::public.user_role,
        'instructor'::public.user_role
      ]
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to finalize check-in');
    END IF;

    IF v_booking.booking_type IS DISTINCT FROM 'flight' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid booking type', 'message', 'Check-in finalization is only valid for flight bookings');
    END IF;
    IF v_booking.status = 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status', 'message', 'Cannot finalize check-in for cancelled bookings');
    END IF;
    IF v_booking.checkin_approved_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already approved', 'message', 'Booking check-in has already been approved');
    END IF;

    SELECT i.id, i.status, i.user_id, i.booking_id, i.tenant_id
    INTO v_invoice
    FROM public.invoices i
    WHERE i.id = p_invoice_id AND i.deleted_at IS NULL;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice not found', 'message', 'The specified invoice does not exist or has been deleted');
    END IF;

    IF v_invoice.tenant_id IS DISTINCT FROM v_tenant_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Invoice does not belong to this booking tenant');
    END IF;

    IF v_invoice.status <> 'draft' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid invoice status', 'message', 'Invoice must be in draft status');
    END IF;
    IF v_invoice.user_id <> v_booking.user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'User mismatch', 'message', 'Invoice user does not match booking user');
    END IF;
    IF v_invoice.booking_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already linked', 'message', 'Invoice is already linked to another booking');
    END IF;

    IF p_billing_basis IS NULL OR p_billing_basis NOT IN ('hobbs', 'tacho', 'airswitch') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid billing_basis', 'message', 'billing_basis must be one of hobbs, tacho, airswitch');
    END IF;
    IF p_billing_hours IS NULL OR p_billing_hours <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid billing_hours', 'message', 'billing_hours must be greater than zero');
    END IF;

    SELECT a.id, a.total_time_method, a.total_time_in_service, a.tenant_id
    INTO v_aircraft
    FROM public.aircraft a
    WHERE a.id = p_checked_out_aircraft_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Aircraft not found');
    END IF;

    IF v_aircraft.tenant_id IS DISTINCT FROM v_tenant_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Aircraft does not belong to this booking tenant');
    END IF;

    v_method := v_aircraft.total_time_method;
    IF v_method IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid aircraft total_time_method', 'message', 'Aircraft total_time_method must be set');
    END IF;

    v_hobbs_delta := CASE WHEN p_hobbs_start IS NULL OR p_hobbs_end IS NULL THEN NULL ELSE p_hobbs_end - p_hobbs_start END;
    v_tach_delta := CASE WHEN p_tach_start IS NULL OR p_tach_end IS NULL THEN NULL ELSE p_tach_end - p_tach_start END;
    v_airswitch_delta := CASE WHEN p_airswitch_start IS NULL OR p_airswitch_end IS NULL THEN NULL ELSE p_airswitch_end - p_airswitch_start END;

    IF v_hobbs_delta IS NOT NULL AND v_hobbs_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid hobbs delta');
    END IF;
    IF v_tach_delta IS NOT NULL AND v_tach_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid tach delta');
    END IF;
    IF v_airswitch_delta IS NOT NULL AND v_airswitch_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid airswitch delta');
    END IF;

    v_applied_delta := public.calculate_applied_aircraft_delta(v_method, v_hobbs_delta, v_tach_delta);
    v_old_ttis := v_aircraft.total_time_in_service;
    v_new_ttis := v_old_ttis + v_applied_delta;
    IF v_applied_delta IS NULL OR v_applied_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid applied delta');
    END IF;

    PERFORM pg_catalog.set_config('app.ttis_change_source', 'checkin_finalize', true);
    PERFORM pg_catalog.set_config('app.bypass_aircraft_total_check', 'true', true);
    UPDATE public.aircraft
    SET total_time_in_service = v_new_ttis,
        current_hobbs = COALESCE(p_hobbs_end, current_hobbs),
        current_tach = COALESCE(p_tach_end, current_tach)
    WHERE id = p_checked_out_aircraft_id;

    UPDATE public.bookings
    SET status = 'complete',
        checked_out_aircraft_id = p_checked_out_aircraft_id,
        checked_out_instructor_id = p_checked_out_instructor_id,
        flight_type_id = p_flight_type_id,
        hobbs_start = p_hobbs_start,
        hobbs_end = p_hobbs_end,
        tach_start = p_tach_start,
        tach_end = p_tach_end,
        airswitch_start = p_airswitch_start,
        airswitch_end = p_airswitch_end,
        solo_end_hobbs = p_solo_end_hobbs,
        solo_end_tach = p_solo_end_tach,
        dual_time = p_dual_time,
        solo_time = p_solo_time,
        flight_time_hobbs = v_hobbs_delta,
        flight_time_tach = v_tach_delta,
        flight_time_airswitch = v_airswitch_delta,
        billing_basis = p_billing_basis,
        billing_hours = p_billing_hours,
        total_hours_start = v_old_ttis,
        total_hours_end = v_new_ttis,
        applied_aircraft_delta = v_applied_delta,
        applied_total_time_method = v_method,
        checkin_invoice_id = p_invoice_id,
        checkin_approved_at = now(),
        checkin_approved_by = v_actor,
        checked_in_at = COALESCE(v_booking.checked_in_at, now())
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'invoice_id', p_invoice_id,
      'applied_aircraft_delta', v_applied_delta,
      'total_hours_start', v_old_ttis,
      'total_hours_end', v_new_ttis,
      'message', 'Booking check-in finalized and TTIS updated atomically'
    );

  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE,
      'message', 'Atomic check-in finalization rolled back'
    );
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.correct_booking_checkin_ttis_atomic(
  p_booking_id uuid,
  p_hobbs_end numeric,
  p_tach_end numeric,
  p_airswitch_end numeric,
  p_correction_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid;
  v_tenant_id uuid;
  v_booking record;
  v_aircraft record;
  v_new_hobbs_delta numeric;
  v_new_tach_delta numeric;
  v_new_airswitch_delta numeric;
  v_method text;
  v_old_applied_delta numeric;
  v_new_applied_delta numeric;
  v_correction_delta numeric;
  v_aircraft_old_ttis numeric;
  v_aircraft_new_ttis numeric;
  v_booking_new_total_hours_end numeric;
  v_is_most_recent_booking boolean;
  v_should_update_current_meters boolean;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized', 'message', 'Authentication required');
    END IF;

    IF p_correction_reason IS NULL OR length(trim(p_correction_reason)) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid correction_reason', 'message', 'correction_reason is required');
    END IF;

    SELECT b.id, b.tenant_id, b.booking_type, b.status, b.checkin_approved_at, b.checked_out_aircraft_id, b.end_time, b.hobbs_start, b.tach_start, b.airswitch_start, b.applied_aircraft_delta, b.applied_total_time_method, b.total_hours_end
    INTO v_booking
    FROM public.bookings b
    WHERE b.id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Booking not found');
    END IF;

    v_tenant_id := v_booking.tenant_id;
    IF v_tenant_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing tenant', 'message', 'Booking has no tenant');
    END IF;

    IF NOT public.user_belongs_to_tenant(v_tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Access denied');
    END IF;

    IF NOT public.check_user_role_simple(
      v_actor,
      v_tenant_id,
      ARRAY['admin'::public.user_role, 'owner'::public.user_role, 'instructor'::public.user_role]
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to correct check-in');
    END IF;

    IF v_booking.booking_type IS DISTINCT FROM 'flight' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid booking type', 'message', 'Corrections are only valid for flight bookings');
    END IF;
    IF v_booking.status = 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status', 'message', 'Cannot correct cancelled bookings');
    END IF;
    IF v_booking.checkin_approved_at IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not approved', 'message', 'Cannot correct an unapproved check-in');
    END IF;
    IF v_booking.checked_out_aircraft_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing aircraft', 'message', 'Booking has no checked_out_aircraft_id');
    END IF;

    v_old_applied_delta := v_booking.applied_aircraft_delta;
    IF v_old_applied_delta IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing applied delta', 'message', 'Booking is missing applied_aircraft_delta (cannot correct safely)');
    END IF;

    v_method := v_booking.applied_total_time_method;
    IF v_method IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing method snapshot', 'message', 'Booking is missing applied_total_time_method (cannot correct deterministically)');
    END IF;

    SELECT a.id, a.tenant_id, a.total_time_in_service, a.current_tach, a.current_hobbs
    INTO v_aircraft
    FROM public.aircraft a
    WHERE a.id = v_booking.checked_out_aircraft_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Aircraft not found');
    END IF;

    IF v_aircraft.tenant_id IS DISTINCT FROM v_tenant_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Aircraft does not belong to booking tenant');
    END IF;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.bookings b2
      WHERE b2.checked_out_aircraft_id = v_booking.checked_out_aircraft_id
        AND b2.status = 'complete'
        AND b2.checkin_approved_at IS NOT NULL
        AND b2.id != p_booking_id
        AND (b2.end_time > v_booking.end_time OR (b2.end_time = v_booking.end_time AND b2.checkin_approved_at > v_booking.checkin_approved_at))
    ) INTO v_is_most_recent_booking;
    v_should_update_current_meters := v_is_most_recent_booking;

    v_new_hobbs_delta := CASE WHEN v_booking.hobbs_start IS NULL OR p_hobbs_end IS NULL THEN NULL ELSE p_hobbs_end - v_booking.hobbs_start END;
    v_new_tach_delta := CASE WHEN v_booking.tach_start IS NULL OR p_tach_end IS NULL THEN NULL ELSE p_tach_end - v_booking.tach_start END;
    v_new_airswitch_delta := CASE WHEN v_booking.airswitch_start IS NULL OR p_airswitch_end IS NULL THEN NULL ELSE p_airswitch_end - v_booking.airswitch_start END;

    IF v_new_hobbs_delta IS NOT NULL AND v_new_hobbs_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid hobbs delta', 'message', 'New hobbs_end must be >= hobbs_start');
    END IF;
    IF v_new_tach_delta IS NOT NULL AND v_new_tach_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid tach delta', 'message', 'New tach_end must be >= tach_start');
    END IF;
    IF v_new_airswitch_delta IS NOT NULL AND v_new_airswitch_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid airswitch delta', 'message', 'New airswitch_end must be >= airswitch_start');
    END IF;

    v_new_applied_delta := public.calculate_applied_aircraft_delta(v_method, v_new_hobbs_delta, v_new_tach_delta);
    v_correction_delta := v_new_applied_delta - v_old_applied_delta;
    v_aircraft_old_ttis := v_aircraft.total_time_in_service;
    v_aircraft_new_ttis := v_aircraft_old_ttis + v_correction_delta;

    IF v_aircraft_new_ttis < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid correction', 'message', 'Correction would result in negative aircraft TTIS');
    END IF;

    PERFORM pg_catalog.set_config('app.ttis_change_source', 'checkin_correction', true);
    PERFORM pg_catalog.set_config('app.bypass_aircraft_total_check', 'true', true);
    IF v_should_update_current_meters THEN
      UPDATE public.aircraft
      SET total_time_in_service = v_aircraft_new_ttis,
          current_tach = COALESCE(p_tach_end, current_tach),
          current_hobbs = COALESCE(p_hobbs_end, current_hobbs)
      WHERE id = v_booking.checked_out_aircraft_id
        AND tenant_id = v_tenant_id;
    ELSE
      UPDATE public.aircraft
      SET total_time_in_service = v_aircraft_new_ttis
      WHERE id = v_booking.checked_out_aircraft_id
        AND tenant_id = v_tenant_id;
    END IF;

    v_booking_new_total_hours_end := COALESCE(v_booking.total_hours_end, 0) + v_correction_delta;

    UPDATE public.bookings
    SET hobbs_end = p_hobbs_end,
        tach_end = p_tach_end,
        airswitch_end = p_airswitch_end,
        flight_time_hobbs = v_new_hobbs_delta,
        flight_time_tach = v_new_tach_delta,
        flight_time_airswitch = v_new_airswitch_delta,
        applied_aircraft_delta = v_new_applied_delta,
        correction_delta = v_correction_delta,
        corrected_at = now(),
        corrected_by = v_actor,
        correction_reason = p_correction_reason,
        total_hours_end = v_booking_new_total_hours_end
    WHERE id = p_booking_id
      AND tenant_id = v_tenant_id;

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'old_applied_delta', v_old_applied_delta,
      'new_applied_delta', v_new_applied_delta,
      'correction_delta', v_correction_delta,
      'aircraft_total_time_in_service', v_aircraft_new_ttis,
      'is_most_recent_booking', v_is_most_recent_booking,
      'updated_current_meters', v_should_update_current_meters,
      'message', 'Booking TTIS correction applied atomically' ||
        CASE WHEN v_should_update_current_meters
          THEN ' (current meters updated)'
          ELSE ' (current meters unchanged - not most recent booking)'
        END
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', SQLSTATE, 'message', 'Atomic TTIS correction rolled back due to error');
  END;
END;
$$;
