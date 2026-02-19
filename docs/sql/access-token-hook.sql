create or replace function public.flightdesk_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  v_user_id uuid;
  v_tenant_id text;
  v_app_role text;
begin
  v_user_id := (event->>'user_id')::uuid;
  claims := coalesce(event->'claims', '{}'::jsonb);

  -- Reuse existing source-of-truth functions in this project.
  select public.get_user_tenant(v_user_id) into v_tenant_id;
  select public.get_tenant_user_role(v_user_id) into v_app_role;

  claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id), true);
  claims := jsonb_set(claims, '{app_role}', to_jsonb(v_app_role), true);

  event := jsonb_set(event, '{claims}', claims, true);
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.flightdesk_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.flightdesk_access_token_hook(jsonb) from anon, authenticated, public;
