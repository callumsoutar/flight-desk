-- Member balances list: one row per tenant user with statement-aligned balance and invoice rollups.
-- Balance = sum(non-deleted invoice line totals) - sum(payments) - sum(member credit top-up credits),
-- matching lib/account-statement/build-account-statement.ts

CREATE OR REPLACE FUNCTION public.get_member_balance_metrics(
  p_tenant_id uuid,
  p_time_zone text DEFAULT 'Pacific/Auckland'
)
RETURNS TABLE (
  user_id uuid,
  current_balance numeric,
  open_invoice_count integer,
  overdue_invoice_count integer,
  overdue_amount numeric,
  oldest_overdue_due_date date,
  last_payment_at timestamp with time zone
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH params AS (
    SELECT (now() AT TIME ZONE p_time_zone)::date AS today
  ),
  tu AS (
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
  ),
  inv_lines AS (
    SELECT
      i.user_id,
      i.status,
      i.due_date,
      i.balance_due,
      (i.due_date AT TIME ZONE p_time_zone)::date AS due_local_date
    FROM public.invoices i
    WHERE i.tenant_id = p_tenant_id
      AND i.deleted_at IS NULL
  ),
  open_counts AS (
    SELECT
      il.user_id,
      count(*)::integer AS open_invoice_count
    FROM inv_lines il
    WHERE coalesce(il.balance_due, 0) > 0
      AND il.status NOT IN ('cancelled', 'refunded', 'draft')
    GROUP BY il.user_id
  ),
  overdue_per_invoice AS (
    SELECT
      il.user_id,
      il.due_local_date,
      il.balance_due,
      coalesce(il.balance_due, 0) > 0
        AND il.status NOT IN ('cancelled', 'refunded', 'draft', 'paid')
        AND (
          il.status = 'overdue'
          OR (
            il.status = 'authorised'
            AND il.due_date IS NOT NULL
            AND il.due_local_date < p.today
          )
        ) AS is_overdue
    FROM inv_lines il
    CROSS JOIN params p
  ),
  overdue_stats AS (
    SELECT
      oi.user_id,
      (count(*) FILTER (WHERE oi.is_overdue))::integer AS overdue_invoice_count,
      round(
        coalesce(
          sum(CASE WHEN oi.is_overdue THEN coalesce(oi.balance_due, 0) ELSE 0 END),
          0
        ),
        2
      ) AS overdue_amount,
      min(oi.due_local_date) FILTER (WHERE oi.is_overdue) AS oldest_overdue_due_date
    FROM overdue_per_invoice oi
    GROUP BY oi.user_id
  )
  SELECT
    tuser.user_id,
    round(
      coalesce(it.invoice_total, 0)
      - coalesce(pt.payment_total, 0)
      - coalesce(ct.credit_total, 0),
      2
    ) AS current_balance,
    coalesce(oc.open_invoice_count, 0) AS open_invoice_count,
    coalesce(ovs.overdue_invoice_count, 0) AS overdue_invoice_count,
    coalesce(ovs.overdue_amount, 0) AS overdue_amount,
    ovs.oldest_overdue_due_date,
    lp.last_at AS last_payment_at
  FROM tu tuser
  LEFT JOIN inv_totals it ON it.user_id = tuser.user_id
  LEFT JOIN pay_totals pt ON pt.user_id = tuser.user_id
  LEFT JOIN cred_totals ct ON ct.user_id = tuser.user_id
  LEFT JOIN open_counts oc ON oc.user_id = tuser.user_id
  LEFT JOIN overdue_stats ovs ON ovs.user_id = tuser.user_id
  LEFT JOIN last_pay lp ON lp.user_id = tuser.user_id
$$;

REVOKE ALL ON FUNCTION public.get_member_balance_metrics(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_balance_metrics(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_balance_metrics(uuid, text) TO service_role;

COMMENT ON FUNCTION public.get_member_balance_metrics(uuid, text) IS
  'Per-user account balance and open/overdue invoice rollups for a tenant (aligns with build-account-statement).';
