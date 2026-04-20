-- Allow instructors to read audit_logs rows for bookings only.
--
-- Background:
--   The previous SELECT policy on public.audit_logs only granted access to
--   owners and admins. The booking detail page reads audit_logs to render the
--   "Booking History" timeline, so instructors saw an empty / errored timeline
--   even though they have full access to the underlying booking record.
--
-- Goal:
--   Extend SELECT to instructors, but only for table_name = 'bookings'.
--   Other entity audit history (invoices, transactions, invoice_payments,
--   users, exam_results, etc.) remains restricted to owners / admins so we
--   don't leak financial or sensitive change history to instructors.
--
-- Insert policy is left unchanged (instructors are already allowed to insert
-- audit rows for the actions they perform).

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
      table_name = 'bookings'
      and public.tenant_user_has_role(
        (select auth.uid()),
        tenant_id,
        array['instructor'::public.user_role]
      )
    )
  )
);

commit;
