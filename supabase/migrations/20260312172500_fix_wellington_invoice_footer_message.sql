begin;

update public.tenant_settings ts
set settings = jsonb_set(
      ts.settings,
      '{invoice_footer_message}',
      to_jsonb('Thank you for choosing Wellington Flight Training.'::text),
      true
    )
from public.tenants t
where t.id = ts.tenant_id
  and t.name = 'Wellington Flight Training'
  and coalesce(ts.settings->>'invoice_footer_message', '') ilike '%Kapiti Aero Club%';

commit;
