-- Baseline RLS policy versioning for tenant-bound tables in audit scope.
-- This migration captures live policy definitions that were previously not
-- discoverable in the current repo migration subset.

begin;

-- ---------------------------------------------------------------------------
-- aircraft_types
-- ---------------------------------------------------------------------------
alter table public.aircraft_types enable row level security;

drop policy if exists aircraft_types_tenant_select on public.aircraft_types;
create policy aircraft_types_tenant_select
on public.aircraft_types
for select
to public
using (
  public.user_belongs_to_tenant(tenant_id)
);

drop policy if exists aircraft_types_tenant_insert on public.aircraft_types;
create policy aircraft_types_tenant_insert
on public.aircraft_types
for insert
to public
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
);

drop policy if exists aircraft_types_tenant_update on public.aircraft_types;
create policy aircraft_types_tenant_update
on public.aircraft_types
for update
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
);

drop policy if exists aircraft_types_tenant_delete on public.aircraft_types;
create policy aircraft_types_tenant_delete
on public.aircraft_types
for delete
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- flight_experience
-- ---------------------------------------------------------------------------
alter table public.flight_experience enable row level security;

drop policy if exists flight_experience_tenant_select on public.flight_experience;
create policy flight_experience_tenant_select
on public.flight_experience
for select
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and (
    user_id = (select auth.uid())
    or public.tenant_user_has_role(
      (select auth.uid()),
      tenant_id,
      array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
    )
  )
);

drop policy if exists flight_experience_tenant_insert on public.flight_experience;
create policy flight_experience_tenant_insert
on public.flight_experience
for insert
to public
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

drop policy if exists flight_experience_tenant_update on public.flight_experience;
create policy flight_experience_tenant_update
on public.flight_experience
for update
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

drop policy if exists flight_experience_tenant_delete on public.flight_experience;
create policy flight_experience_tenant_delete
on public.flight_experience
for delete
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- invoice_items
-- ---------------------------------------------------------------------------
alter table public.invoice_items enable row level security;

drop policy if exists invoice_items_tenant_select on public.invoice_items;
create policy invoice_items_tenant_select
on public.invoice_items
for select
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and (
    deleted_at is null
    or public.tenant_user_has_role(
      (select auth.uid()),
      tenant_id,
      array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
    )
  )
);

drop policy if exists invoice_items_tenant_insert on public.invoice_items;
create policy invoice_items_tenant_insert
on public.invoice_items
for insert
to public
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

drop policy if exists invoice_items_tenant_update on public.invoice_items;
create policy invoice_items_tenant_update
on public.invoice_items
for update
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
)
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

drop policy if exists invoice_items_tenant_delete on public.invoice_items;
create policy invoice_items_tenant_delete
on public.invoice_items
for delete
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- invoice_payments
-- ---------------------------------------------------------------------------
alter table public.invoice_payments enable row level security;

drop policy if exists invoice_payments_tenant_select on public.invoice_payments;
create policy invoice_payments_tenant_select
on public.invoice_payments
for select
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_payments.invoice_id
        and i.user_id = (select auth.uid())
        and i.deleted_at is null
    )
    or public.tenant_user_has_role(
      (select auth.uid()),
      tenant_id,
      array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
    )
  )
);

drop policy if exists invoice_payments_tenant_insert on public.invoice_payments;
create policy invoice_payments_tenant_insert
on public.invoice_payments
for insert
to public
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

drop policy if exists invoice_payments_tenant_update on public.invoice_payments;
create policy invoice_payments_tenant_update
on public.invoice_payments
for update
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
)
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

drop policy if exists invoice_payments_tenant_delete on public.invoice_payments;
create policy invoice_payments_tenant_delete
on public.invoice_payments
for delete
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
alter table public.invoices enable row level security;

drop policy if exists invoices_tenant_select on public.invoices;
create policy invoices_tenant_select
on public.invoices
for select
to public
using (
  public.user_belongs_to_tenant(tenant_id)
);

drop policy if exists invoices_tenant_insert on public.invoices;
create policy invoices_tenant_insert
on public.invoices
for insert
to public
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

drop policy if exists invoices_tenant_update on public.invoices;
create policy invoices_tenant_update
on public.invoices
for update
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- lesson_progress
-- ---------------------------------------------------------------------------
alter table public.lesson_progress enable row level security;

drop policy if exists lesson_progress_tenant_select on public.lesson_progress;
create policy lesson_progress_tenant_select
on public.lesson_progress
for select
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and (
    user_id = (select auth.uid())
    or instructor_id = (select auth.uid())
    or public.tenant_user_has_role(
      (select auth.uid()),
      tenant_id,
      array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
    )
  )
);

drop policy if exists lesson_progress_tenant_insert on public.lesson_progress;
create policy lesson_progress_tenant_insert
on public.lesson_progress
for insert
to public
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

drop policy if exists lesson_progress_tenant_update on public.lesson_progress;
create policy lesson_progress_tenant_update
on public.lesson_progress
for update
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

drop policy if exists lesson_progress_tenant_delete on public.lesson_progress;
create policy lesson_progress_tenant_delete
on public.lesson_progress
for delete
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- student_syllabus_enrollment
-- ---------------------------------------------------------------------------
alter table public.student_syllabus_enrollment enable row level security;

drop policy if exists student_syllabus_enrollment_tenant_select on public.student_syllabus_enrollment;
create policy student_syllabus_enrollment_tenant_select
on public.student_syllabus_enrollment
for select
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and (
    user_id = (select auth.uid())
    or public.tenant_user_has_role(
      (select auth.uid()),
      tenant_id,
      array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
    )
  )
);

drop policy if exists student_syllabus_enrollment_tenant_insert on public.student_syllabus_enrollment;
create policy student_syllabus_enrollment_tenant_insert
on public.student_syllabus_enrollment
for insert
to public
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

drop policy if exists student_syllabus_enrollment_tenant_update on public.student_syllabus_enrollment;
create policy student_syllabus_enrollment_tenant_update
on public.student_syllabus_enrollment
for update
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

drop policy if exists student_syllabus_enrollment_tenant_delete on public.student_syllabus_enrollment;
create policy student_syllabus_enrollment_tenant_delete
on public.student_syllabus_enrollment
for delete
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- syllabus
-- ---------------------------------------------------------------------------
alter table public.syllabus enable row level security;

drop policy if exists syllabus_tenant_select on public.syllabus;
create policy syllabus_tenant_select
on public.syllabus
for select
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and (
    (is_active = true and voided_at is null)
    or public.tenant_user_has_role(
      (select auth.uid()),
      tenant_id,
      array['owner'::public.user_role, 'admin'::public.user_role]
    )
  )
);

drop policy if exists syllabus_tenant_insert on public.syllabus;
create policy syllabus_tenant_insert
on public.syllabus
for insert
to public
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
);

drop policy if exists syllabus_tenant_update on public.syllabus;
create policy syllabus_tenant_update
on public.syllabus
for update
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
)
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
);

drop policy if exists syllabus_tenant_delete on public.syllabus;
create policy syllabus_tenant_delete
on public.syllabus
for delete
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- tenant_users
-- ---------------------------------------------------------------------------
alter table public.tenant_users enable row level security;

drop policy if exists tenant_users_select on public.tenant_users;
create policy tenant_users_select
on public.tenant_users
for select
to public
using (
  user_id = (select auth.uid())
  or public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
);

drop policy if exists tenant_users_insert on public.tenant_users;
create policy tenant_users_insert
on public.tenant_users
for insert
to public
with check (
  public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
);

drop policy if exists tenant_users_update on public.tenant_users;
create policy tenant_users_update
on public.tenant_users
for update
to public
using (
  public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
)
with check (
  public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
);

drop policy if exists tenant_users_delete on public.tenant_users;
create policy tenant_users_delete
on public.tenant_users
for delete
to public
using (
  public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;

drop policy if exists tenants_select on public.tenants;
create policy tenants_select
on public.tenants
for select
to public
using (
  id in (
    select tu.tenant_id
    from public.tenant_users tu
    where tu.user_id = (select auth.uid())
      and tu.is_active = true
  )
);

drop policy if exists tenants_insert on public.tenants;
create policy tenants_insert
on public.tenants
for insert
to public
with check (
  public.tenant_user_has_role(
    (select auth.uid()),
    id,
    array['owner'::public.user_role]
  )
);

drop policy if exists tenants_update on public.tenants;
create policy tenants_update
on public.tenants
for update
to public
using (
  public.tenant_user_has_role(
    (select auth.uid()),
    id,
    array['owner'::public.user_role]
  )
)
with check (
  public.tenant_user_has_role(
    (select auth.uid()),
    id,
    array['owner'::public.user_role]
  )
);

drop policy if exists tenants_delete on public.tenants;
create policy tenants_delete
on public.tenants
for delete
to public
using (
  public.tenant_user_has_role(
    (select auth.uid()),
    id,
    array['owner'::public.user_role]
  )
);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
alter table public.transactions enable row level security;

drop policy if exists transactions_tenant_select on public.transactions;
create policy transactions_tenant_select
on public.transactions
for select
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and (
    user_id = (select auth.uid())
    or public.tenant_user_has_role(
      (select auth.uid()),
      tenant_id,
      array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
    )
  )
);

drop policy if exists transactions_tenant_insert on public.transactions;
create policy transactions_tenant_insert
on public.transactions
for insert
to public
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

drop policy if exists transactions_tenant_update on public.transactions;
create policy transactions_tenant_update
on public.transactions
for update
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
)
with check (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

drop policy if exists transactions_tenant_delete on public.transactions;
create policy transactions_tenant_delete
on public.transactions
for delete
to public
using (
  public.user_belongs_to_tenant(tenant_id)
  and public.tenant_user_has_role(
    (select auth.uid()),
    tenant_id,
    array['owner'::public.user_role, 'admin'::public.user_role, 'instructor'::public.user_role]
  )
);

commit;
