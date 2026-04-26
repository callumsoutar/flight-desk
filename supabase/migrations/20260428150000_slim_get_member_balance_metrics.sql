-- Slim member balance metrics: balance + last payment only (no open/overdue rollups)

CREATE OR REPLACE FUNCTION public.get_member_balance_metrics(
  p_tenant_id uuid,
  p_time_zone text DEFAULT 'Pacific/Auckland'
)
RETURNS TABLE (
  user_id uuid,
  current_balance numeric,
  last_payment_at timestamp with time zone
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH tu AS (
    SELECT tnu.user_id
    FROM public.tenant_users tnu
    WHERE tnu.tenant_id = p_tenant_id
  ),
  inv_totals AS (
    SELECT
      i.user_id,
      COALESCE(
        SUM(
          COALESCE(i.total_amount, COALESCE(i.subtotal, 0) + COALESCE(i.tax_total, 0))
        ),
        0
      ) AS invoice_total
    FROM public.invoices i
    WHERE i.tenant_id = p_tenant_id
      AND i.deleted_at IS NULL
    GROUP BY i.user_id
  ),
  pay_totals AS (
    SELECT
      ip.user_id,
      COALESCE(SUM(ip.amount), 0) AS payment_total
    FROM public.invoice_payments ip
    WHERE ip.tenant_id = p_tenant_id
    GROUP BY ip.user_id
  ),
  cred_totals AS (
    SELECT
      t.user_id,
      COALESCE(SUM(t.amount), 0) AS credit_total
    FROM public.transactions t
    WHERE t.tenant_id = p_tenant_id
      AND t.status = 'completed'
      AND t.type = 'credit'
      AND t.metadata @> '{"transaction_type": "member_credit_topup"}'::jsonb
    GROUP BY t.user_id
  ),
  last_pay AS (
    SELECT
      ip.user_id,
      max(ip.paid_at) AS last_at
    FROM public.invoice_payments ip
    WHERE ip.tenant_id = p_tenant_id
    GROUP BY ip.user_id
  )
  SELECT
    tuser.user_id,
    round(
      coalesce(it.invoice_total, 0)
      - coalesce(pt.payment_total, 0)
      - coalesce(ct.credit_total, 0),
      2
    ) AS current_balance,
    lp.last_at AS last_payment_at
  FROM tu tuser
  LEFT JOIN inv_totals it ON it.user_id = tuser.user_id
  LEFT JOIN pay_totals pt ON pt.user_id = tuser.user_id
  LEFT JOIN cred_totals ct ON ct.user_id = tuser.user_id
  LEFT JOIN last_pay lp ON lp.user_id = tuser.user_id
$$;

REVOKE ALL ON FUNCTION public.get_member_balance_metrics(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_balance_metrics(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_balance_metrics(uuid, text) TO service_role;

COMMENT ON FUNCTION public.get_member_balance_metrics(uuid, text) IS
  'Per-user current balance and last payment time for a tenant (aligns with build-account-statement).';
