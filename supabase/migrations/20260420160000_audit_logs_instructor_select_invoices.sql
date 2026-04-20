-- Extend audit_logs SELECT policy to let instructors read invoice-related history.
--
-- Background:
--   The previous policy (20260420150000) only allowed instructors to read
--   audit_logs rows for table_name = 'bookings'. The Invoice History timeline
--   needs to render entries for invoices, invoice_items, and invoice_payments,
--   so instructors must be able to read those rows too.
--
-- Notes:
--   - Owners / admins remain unrestricted.
--   - Other entities (transactions, exam_results, users, chargeables, etc.)
--     are still admin-only because instructors don't view their audit history.
--   - Insert policy is unchanged.

begin;

drop policy if exists audit_logs_tenant_select on public.audit_logs;

create policy audit_logs_tenant_select
on public.audit_logs
for select
using (
  public.user_belongs_to_tenant(tenant_id)
  and (
    public.tenant_user_has_role(
      (select auth.uid()),
      tenant_id,
      array['owner'::public.user_role, 'admin'::public.user_role]
    )
    or (
      table_name in ('bookings', 'invoices', 'invoice_items', 'invoice_payments')
      and public.tenant_user_has_role(
        (select auth.uid()),
        tenant_id,
        array['instructor'::public.user_role]
      )
    )
  )
);

commit;
