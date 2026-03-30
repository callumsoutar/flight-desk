CREATE OR REPLACE FUNCTION public.get_hours_by_flight_type(
  p_tenant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE (
  flight_type_id uuid,
  flight_type_name text,
  instruction_type text,
  flights bigint,
  total_hours numeric,
  dual_hours numeric,
  solo_hours numeric,
  pct_of_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = (SELECT auth.uid())
      AND tenant_id = p_tenant_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH totals AS (
    SELECT COALESCE(SUM(b.billing_hours), 0) AS grand_total
    FROM bookings b
    WHERE b.tenant_id = p_tenant_id
      AND b.status = 'complete'
      AND b.booking_type = 'flight'
      AND b.start_time BETWEEN p_start_date AND p_end_date
  )
  SELECT
    ft.id AS flight_type_id,
    ft.name AS flight_type_name,
    ft.instruction_type::text,
    COUNT(DISTINCT b.id) AS flights,
    COALESCE(ROUND(SUM(b.billing_hours), 2), 0) AS total_hours,
    COALESCE(ROUND(SUM(b.dual_time), 2), 0) AS dual_hours,
    COALESCE(ROUND(SUM(b.solo_time), 2), 0) AS solo_hours,
    ROUND(
      COALESCE(SUM(b.billing_hours), 0) * 100.0 /
      NULLIF((SELECT grand_total FROM totals), 0),
      1
    ) AS pct_of_total
  FROM flight_types ft
  LEFT JOIN bookings b ON b.flight_type_id = ft.id
    AND b.tenant_id = p_tenant_id
    AND b.status = 'complete'
    AND b.booking_type = 'flight'
    AND b.start_time BETWEEN p_start_date AND p_end_date
  WHERE ft.tenant_id = p_tenant_id
    AND ft.voided_at IS NULL
  GROUP BY ft.id, ft.name, ft.instruction_type
  HAVING COUNT(DISTINCT b.id) > 0
  ORDER BY total_hours DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hours_by_flight_type TO authenticated;
