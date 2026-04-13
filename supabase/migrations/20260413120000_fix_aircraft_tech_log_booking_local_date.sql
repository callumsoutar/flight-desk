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
      coalesce(r.initial_ttis, a.initial_total_time_in_service, 0) as initial_ttis,
      a.total_time_method,
      case
        when a.total_time_method in ('tacho', 'tacho less 5%', 'tacho less 10%') then 'tacho'
        else 'hobbs'
      end as reading_source
    from public.aircraft a
    left join public.aircraft_ttis_rollup r
      on r.aircraft_id = a.id
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
