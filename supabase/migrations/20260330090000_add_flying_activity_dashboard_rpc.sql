CREATE OR REPLACE FUNCTION public.get_flying_activity_dashboard(
  p_tenant_id  uuid,
  p_start_date timestamptz,
  p_end_date   timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result json;
BEGIN
  -- Verify caller belongs to this tenant
  IF NOT EXISTS (
    SELECT 1
    FROM tenant_users
    WHERE user_id = (SELECT auth.uid())
      AND tenant_id = p_tenant_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    -- 1. Total flying hours
    'total_flying_hours',
      COALESCE(ROUND(SUM(billing_hours), 2), 0),

    -- 2. Dual hours
    'dual_hours',
      COALESCE(ROUND(SUM(dual_time), 2), 0),

    -- 3. Solo hours
    'solo_hours',
      COALESCE(ROUND(SUM(solo_time), 2), 0),

    -- 4. Trial flight hours
    'trial_flight_hours',
      COALESCE(
        ROUND(
          SUM(billing_hours) FILTER (
            WHERE flight_type_id IN (
              SELECT id
              FROM flight_types
              WHERE tenant_id = p_tenant_id
                AND instruction_type = 'trial'
            )
          ),
          2
        ),
        0
      ),

    -- 5. Hours by month
    'hours_by_month',
      (
        SELECT json_agg(row_to_json(t) ORDER BY t.month)
        FROM (
          SELECT
            TO_CHAR(DATE_TRUNC('month', start_time), 'YYYY-MM') AS month,
            ROUND(SUM(billing_hours), 2) AS hours
          FROM bookings
          WHERE tenant_id = p_tenant_id
            AND status = 'complete'
            AND booking_type = 'flight'
            AND start_time BETWEEN p_start_date AND p_end_date
          GROUP BY DATE_TRUNC('month', start_time)
        ) t
      ),

    -- 6. Weekend vs weekday hours
    'weekend_hours',
      COALESCE(
        ROUND(SUM(billing_hours) FILTER (WHERE EXTRACT(DOW FROM start_time) IN (0, 6)), 2),
        0
      ),
    'weekday_hours',
      COALESCE(
        ROUND(SUM(billing_hours) FILTER (WHERE EXTRACT(DOW FROM start_time) NOT IN (0, 6)), 2),
        0
      ),

    -- 7. Hours by flight type
    'hours_by_flight_type',
      (
        SELECT json_agg(row_to_json(t) ORDER BY t.hours DESC)
        FROM (
          SELECT
            COALESCE(ft.name, 'Unknown') AS flight_type,
            ROUND(SUM(b2.billing_hours), 2) AS hours
          FROM bookings b2
          LEFT JOIN flight_types ft ON ft.id = b2.flight_type_id
          WHERE b2.tenant_id = p_tenant_id
            AND b2.status = 'complete'
            AND b2.booking_type = 'flight'
            AND b2.start_time BETWEEN p_start_date AND p_end_date
          GROUP BY ft.name
        ) t
      ),

    -- 8. Hours by syllabus stage
    'hours_by_stage',
      (
        SELECT json_agg(row_to_json(t) ORDER BY t.hours DESC)
        FROM (
          SELECT
            COALESCE(l.syllabus_stage::text, 'No Exercise') AS stage,
            ROUND(SUM(b2.billing_hours), 2) AS hours
          FROM bookings b2
          LEFT JOIN lessons l ON l.id = b2.lesson_id
          WHERE b2.tenant_id = p_tenant_id
            AND b2.status = 'complete'
            AND b2.booking_type = 'flight'
            AND b2.start_time BETWEEN p_start_date AND p_end_date
          GROUP BY l.syllabus_stage
        ) t
      ),

    -- 9. Average flight duration
    'avg_flight_duration_hours',
      COALESCE(ROUND(AVG(billing_hours), 2), 0),

    -- 10. Booking-to-flight conversion rate
    'conversion_rate',
      (
        SELECT ROUND(
          COUNT(*) FILTER (WHERE status = 'complete')::numeric
          / NULLIF(COUNT(*) FILTER (WHERE status != 'cancelled' OR status IS NOT NULL), 0)
          * 100,
          1
        )
        FROM bookings
        WHERE tenant_id = p_tenant_id
          AND booking_type = 'flight'
          AND start_time BETWEEN p_start_date AND p_end_date
      ),

    -- 11. Cancellation rate by category
    'cancellations_by_category',
      (
        SELECT json_agg(row_to_json(t) ORDER BY t.count DESC)
        FROM (
          SELECT
            COALESCE(cc.name, 'Uncategorised') AS category,
            COUNT(*) AS count
          FROM bookings b2
          LEFT JOIN cancellation_categories cc ON cc.id = b2.cancellation_category_id
          WHERE b2.tenant_id = p_tenant_id
            AND b2.status = 'cancelled'
            AND b2.booking_type = 'flight'
            AND b2.cancelled_at BETWEEN p_start_date AND p_end_date
          GROUP BY cc.name
        ) t
      ),

    -- 12. Flying days per month
    'flying_days_per_month',
      (
        SELECT json_agg(row_to_json(t) ORDER BY t.month)
        FROM (
          SELECT
            TO_CHAR(DATE_TRUNC('month', start_time), 'YYYY-MM') AS month,
            COUNT(DISTINCT DATE(start_time)) AS flying_days
          FROM bookings
          WHERE tenant_id = p_tenant_id
            AND status = 'complete'
            AND booking_type = 'flight'
            AND start_time BETWEEN p_start_date AND p_end_date
          GROUP BY DATE_TRUNC('month', start_time)
        ) t
      )
  ) INTO v_result
  FROM bookings
  WHERE tenant_id = p_tenant_id
    AND status = 'complete'
    AND booking_type = 'flight'
    AND start_time BETWEEN p_start_date AND p_end_date;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_flying_activity_dashboard TO authenticated;
