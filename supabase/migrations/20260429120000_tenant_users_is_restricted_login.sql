-- When true, member/student portal login and API use are blocked (enforced in app). Staff roles ignore.
alter table public.tenant_users
  add column is_restricted_login boolean not null default false;

comment on column public.tenant_users.is_restricted_login is
  'If true, blocks portal access for users with member or student role in this tenant; staff roles are unaffected. Enforced in application layer.';
