-- Lock down shared roles catalog so tenant users cannot mutate it.
-- Roles remain readable for authenticated users.

begin;

drop policy if exists roles_manage on public.roles;
drop policy if exists roles_read_active on public.roles;

create policy roles_read_active
on public.roles
for select
to public
using (
  auth.uid() is not null
  and is_active = true
);

commit;
