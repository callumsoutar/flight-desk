-- Restore user_directory view accidentally removed from production.
-- Many API queries embed this view for user profile lookups.
create or replace view public.user_directory
with (security_invoker = true) as
select
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.phone,
  null::text as public_email,
  u.created_at,
  u.updated_at
from public.users u;

grant select on public.user_directory to anon, authenticated, service_role;
