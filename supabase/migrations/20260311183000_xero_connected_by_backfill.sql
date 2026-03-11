-- Backfill connected_by for historical connections where possible.
-- We use the most recent successful Xero "connect" audit log initiated_by per tenant.
UPDATE public.xero_connections xc
SET connected_by = latest.initiated_by
FROM (
  SELECT DISTINCT ON (tenant_id)
    tenant_id,
    initiated_by
  FROM public.xero_export_logs
  WHERE action = 'connect'
    AND status = 'success'
    AND initiated_by IS NOT NULL
  ORDER BY tenant_id, created_at DESC
) AS latest
WHERE xc.tenant_id = latest.tenant_id
  AND xc.connected_by IS NULL;
