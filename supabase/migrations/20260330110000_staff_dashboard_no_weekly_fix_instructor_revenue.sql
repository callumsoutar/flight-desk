-- Remove weekly_hours from get_staff_dashboard; fix instruction_revenue to include
-- generated instructor lines (chargeable_id IS NULL) and all non-aircraft_hire invoice lines.

CREATE OR REPLACE FUNCTION public.get_staff_dashboard(
  p_tenant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result json;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = (SELECT auth.uid())
      AND tenant_id = p_tenant_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'dual_hours_salary', (
      SELECT COALESCE(ROUND(SUM(b.dual_time), 2), 0)
      FROM bookings b
      JOIN instructors i ON i.id = COALESCE(b.checked_out_instructor_id, b.instructor_id)
      WHERE b.tenant_id = p_tenant_id
        AND b.status = 'complete'
        AND b.booking_type = 'flight'
        AND b.start_time BETWEEN p_start_date AND p_end_date
        AND i.employment_type IN ('full_time', 'part_time')
    ),
    'dual_hours_contractor', (
      SELECT COALESCE(ROUND(SUM(b.dual_time), 2), 0)
      FROM bookings b
      JOIN instructors i ON i.id = COALESCE(b.checked_out_instructor_id, b.instructor_id)
      WHERE b.tenant_id = p_tenant_id
        AND b.status = 'complete'
        AND b.booking_type = 'flight'
        AND b.start_time BETWEEN p_start_date AND p_end_date
        AND i.employment_type IN ('contractor', 'casual')
    ),
    'instructors', (
      SELECT json_agg(row_to_json(t) ORDER BY t.instruction_revenue DESC, t.dual_hours DESC)
      FROM (
        SELECT
          i.id AS instructor_id,
          COALESCE(i.first_name || ' ' || i.last_name, u.first_name || ' ' || u.last_name) AS instructor_name,
          i.employment_type,
          ic.name AS rating,
          COALESCE(ROUND(SUM(bm.dual_time), 2), 0) AS dual_hours,
          COALESCE(ROUND(SUM(bm.solo_time), 2), 0) AS solo_hours,
          COUNT(DISTINCT bm.booking_id) AS flights,
          COUNT(DISTINCT bm.user_id) AS unique_students,
          COALESCE(ROUND(SUM(bm.instruction_revenue), 2), 0) AS instruction_revenue
        FROM (
          SELECT
            b.id AS booking_id,
            b.user_id,
            COALESCE(b.checked_out_instructor_id, b.instructor_id) AS instructor_id,
            b.dual_time,
            b.solo_time,
            COALESCE((
              SELECT SUM(COALESCE(ii.line_total, ii.amount, 0)) FILTER (
                WHERE ii.chargeable_id IS NULL
                  OR ct.code IS DISTINCT FROM 'aircraft_hire'
              )
              FROM invoices inv
              JOIN invoice_items ii ON ii.invoice_id = inv.id AND ii.deleted_at IS NULL
              LEFT JOIN chargeables c ON c.id = ii.chargeable_id
              LEFT JOIN chargeable_types ct ON ct.id = c.chargeable_type_id
              WHERE inv.booking_id = b.id
                AND inv.deleted_at IS NULL
            ), 0) AS instruction_revenue
          FROM bookings b
          WHERE b.tenant_id = p_tenant_id
            AND b.status = 'complete'
            AND b.booking_type = 'flight'
            AND b.start_time BETWEEN p_start_date AND p_end_date
        ) bm
        JOIN instructors i ON i.id = bm.instructor_id
        JOIN users u ON u.id = i.user_id
        LEFT JOIN instructor_categories ic ON ic.id = i.rating
        GROUP BY i.id, instructor_name, i.employment_type, ic.name
      ) t
    ),
    'students_per_instructor', (
      SELECT json_agg(row_to_json(t) ORDER BY t.student_count DESC)
      FROM (
        SELECT
          COALESCE(i.first_name || ' ' || i.last_name, u.first_name || ' ' || u.last_name) AS instructor_name,
          i.employment_type,
          COUNT(DISTINCT sse.user_id) AS student_count,
          json_agg(
            json_build_object(
              'student_id', sse.user_id,
              'student_name', su.first_name || ' ' || su.last_name,
              'syllabus', s.name,
              'enrolled_at', sse.enrolled_at
            )
          ) AS students
        FROM student_syllabus_enrollment sse
        JOIN instructors i ON i.id = sse.primary_instructor_id
        JOIN users u ON u.id = i.user_id
        JOIN users su ON su.id = sse.user_id
        JOIN syllabus s ON s.id = sse.syllabus_id
        WHERE sse.tenant_id = p_tenant_id
          AND sse.status = 'active'
        GROUP BY i.id, instructor_name, i.employment_type
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_dashboard TO authenticated;
