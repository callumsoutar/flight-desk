create or replace function public.get_financial_transaction_list_report(
  p_start timestamptz,
  p_end timestamptz,
  p_limit integer default 500,
  p_offset integer default 0
)
returns table (
  transaction_id uuid,
  transaction_type text,
  related_invoice_id uuid,
  amount numeric,
  payment_method text,
  created_at timestamptz,
  reference text,
  description text
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor uuid;
  v_tenant_id uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Unauthorized';
  end if;

  if p_start is null or p_end is null then
    raise exception 'Start and end datetimes are required';
  end if;

  if p_start > p_end then
    raise exception 'Start datetime must be before or equal to end datetime';
  end if;

  v_tenant_id := public.get_user_tenant(v_actor);
  if v_tenant_id is null then
    raise exception 'Missing tenant context';
  end if;

  if not public.check_user_role_simple(
    v_actor,
    v_tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  ) then
    raise exception 'Forbidden';
  end if;

  return query
  with filtered_transactions as (
    select
      t.id,
      t.invoice_id,
      t.amount,
      t.created_at,
      t.reference_number,
      t.description,
      t.metadata
    from public.transactions t
    where t.tenant_id = v_tenant_id
      and t.status = 'completed'::public.transaction_status
      and t.created_at >= p_start
      and t.created_at <= p_end
      and coalesce(t.metadata->>'transaction_type', '') in ('invoice_debit', 'invoice_payment')
  )
  select
    ft.id as transaction_id,
    case
      when ft.metadata->>'transaction_type' = 'invoice_debit' then 'invoice'
      else 'payment'
    end as transaction_type,
    coalesce(ft.invoice_id, ip.invoice_id) as related_invoice_id,
    ft.amount,
    case
      when ft.metadata->>'transaction_type' = 'invoice_payment'
        then coalesce(
          nullif(ft.metadata->>'payment_method', ''),
          ip.payment_method::text,
          'other'
        )
      else null
    end as payment_method,
    ft.created_at,
    coalesce(
      nullif(ft.reference_number, ''),
      nullif(ft.metadata->>'invoice_number', ''),
      nullif(i.invoice_number, ''),
      ft.id::text
    ) as reference,
    coalesce(
      nullif(ft.description, ''),
      case
        when ft.metadata->>'transaction_type' = 'invoice_debit' then 'Invoice'
        else 'Payment'
      end
    ) as description
  from filtered_transactions ft
  left join public.invoice_payments ip
    on ip.transaction_id = ft.id
   and ip.tenant_id = v_tenant_id
  left join public.invoices i
    on i.id = coalesce(ft.invoice_id, ip.invoice_id)
   and i.tenant_id = v_tenant_id
  order by ft.created_at desc, ft.id desc
  limit greatest(coalesce(p_limit, 500), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.get_financial_daily_summary_report(
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  period_start timestamptz,
  period_end timestamptz,
  total_sales numeric,
  total_received numeric,
  difference numeric,
  payment_breakdown jsonb
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor uuid;
  v_tenant_id uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Unauthorized';
  end if;

  if p_start is null or p_end is null then
    raise exception 'Start and end datetimes are required';
  end if;

  if p_start > p_end then
    raise exception 'Start datetime must be before or equal to end datetime';
  end if;

  v_tenant_id := public.get_user_tenant(v_actor);
  if v_tenant_id is null then
    raise exception 'Missing tenant context';
  end if;

  if not public.check_user_role_simple(
    v_actor,
    v_tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  ) then
    raise exception 'Forbidden';
  end if;

  return query
  with filtered_transactions as (
    select
      t.id,
      t.amount,
      t.metadata
    from public.transactions t
    where t.tenant_id = v_tenant_id
      and t.status = 'completed'::public.transaction_status
      and t.created_at >= p_start
      and t.created_at <= p_end
      and coalesce(t.metadata->>'transaction_type', '') in ('invoice_debit', 'invoice_payment')
  ),
  payment_rows as (
    select
      coalesce(
        nullif(ft.metadata->>'payment_method', ''),
        ip.payment_method::text,
        'other'
      ) as payment_method,
      ft.amount
    from filtered_transactions ft
    left join public.invoice_payments ip
      on ip.transaction_id = ft.id
     and ip.tenant_id = v_tenant_id
    where ft.metadata->>'transaction_type' = 'invoice_payment'
  ),
  sales as (
    select coalesce(sum(ft.amount), 0) as total_sales
    from filtered_transactions ft
    where ft.metadata->>'transaction_type' = 'invoice_debit'
  ),
  received as (
    select coalesce(sum(pr.amount), 0) as total_received
    from payment_rows pr
  ),
  payment_groups as (
    select
      pr.payment_method,
      round(sum(pr.amount), 2) as total_amount,
      count(*)::integer as transaction_count
    from payment_rows pr
    group by pr.payment_method
  ),
  breakdown as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'payment_method', pg.payment_method,
          'total_amount', pg.total_amount,
          'transaction_count', pg.transaction_count
        )
        order by pg.payment_method
      ),
      '[]'::jsonb
    ) as payment_breakdown
    from payment_groups pg
  )
  select
    p_start as period_start,
    p_end as period_end,
    round(s.total_sales, 2) as total_sales,
    round(r.total_received, 2) as total_received,
    round(s.total_sales - r.total_received, 2) as difference,
    b.payment_breakdown
  from sales s
  cross join received r
  cross join breakdown b;
end;
$$;
