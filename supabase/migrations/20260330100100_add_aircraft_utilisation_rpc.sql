-- RPC: get_aircraft_utilisation_dashboard
CREATE OR REPLACE FUNCTION public.get_aircraft_utilisation_dashboard(
  p_tenant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_daily_available_hours numeric DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result json;
  v_period_days int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = (SELECT auth.uid())
      AND tenant_id = p_tenant_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_period_days := GREATEST(1, EXTRACT(DAYS FROM p_end_date - p_start_date)::int);

  SELECT json_build_object(
    'period_days', v_period_days,
    'daily_available_hours', p_daily_available_hours,
    'aircraft', (
      SELECT json_agg(row_to_json(t) ORDER BY t.utilisation_pct DESC)
      FROM (
        SELECT
          a.id AS aircraft_id,
          a.registration,
          COALESCE(at2.name, a.type) AS aircraft_type,
          a.total_time_in_service AS current_ttis,
          COALESCE(ROUND(SUM(b.applied_aircraft_delta), 2), 0) AS hours_flown,
          COALESCE((
            SELECT COUNT(DISTINCT DATE(mv.visit_date))
            FROM maintenance_visits mv
            WHERE mv.aircraft_id = a.id
              AND mv.visit_date BETWEEN p_start_date AND p_end_date
          ), 0) AS maintenance_days,
          ROUND(
            (v_period_days - COALESCE((
              SELECT COUNT(DISTINCT DATE(mv.visit_date))
              FROM maintenance_visits mv
              WHERE mv.aircraft_id = a.id
                AND mv.visit_date BETWEEN p_start_date AND p_end_date
            ), 0)) * p_daily_available_hours,
            2
          ) AS available_hours,
          ROUND(
            COALESCE(SUM(b.applied_aircraft_delta), 0) /
            NULLIF(
              (v_period_days - COALESCE((
                SELECT COUNT(DISTINCT DATE(mv.visit_date))
                FROM maintenance_visits mv
                WHERE mv.aircraft_id = a.id
                  AND mv.visit_date BETWEEN p_start_date AND p_end_date
              ), 0)) * p_daily_available_hours,
              0
            ) * 100,
            1
          ) AS utilisation_pct,
          COALESCE(ROUND(SUM(ii.amount) FILTER (WHERE ct.code = 'aircraft_hire'), 2), 0) AS hire_revenue,
          COUNT(DISTINCT b.id) AS flights,
          COALESCE((
            SELECT COUNT(*) FROM observations o
            WHERE o.aircraft_id = a.id AND o.stage NOT IN ('closed')
          ), 0) AS open_observations
        FROM aircraft a
        LEFT JOIN aircraft_types at2 ON at2.id = a.aircraft_type_id
        LEFT JOIN bookings b ON b.checked_out_aircraft_id = a.id
          AND b.status = 'complete'
          AND b.booking_type = 'flight'
          AND b.start_time BETWEEN p_start_date AND p_end_date
        LEFT JOIN invoices inv ON inv.booking_id = b.id AND inv.deleted_at IS NULL
        LEFT JOIN invoice_items ii ON ii.invoice_id = inv.id AND ii.deleted_at IS NULL
        LEFT JOIN chargeables c ON c.id = ii.chargeable_id
        LEFT JOIN chargeable_types ct ON ct.id = c.chargeable_type_id
        WHERE a.tenant_id = p_tenant_id
          AND a.on_line = true
        GROUP BY a.id, a.registration, a.type, at2.name, a.total_time_in_service
      ) t
    ),
    'monthly_by_aircraft', (
      SELECT json_agg(row_to_json(t) ORDER BY t.month, t.registration)
      FROM (
        SELECT
          TO_CHAR(DATE_TRUNC('month', b.start_time), 'YYYY-MM') AS month,
          a.registration,
          COALESCE(ROUND(SUM(b.applied_aircraft_delta), 2), 0) AS hours_flown
        FROM bookings b
        JOIN aircraft a ON a.id = b.checked_out_aircraft_id
        WHERE b.tenant_id = p_tenant_id
          AND b.status = 'complete'
          AND b.booking_type = 'flight'
          AND b.start_time BETWEEN p_start_date AND p_end_date
        GROUP BY DATE_TRUNC('month', b.start_time), a.id, a.registration
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_aircraft_utilisation_dashboard TO authenticated;
