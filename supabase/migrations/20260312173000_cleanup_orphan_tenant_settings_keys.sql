begin;

with valid_keys as (
  select array[
    'business_open_time','business_close_time','business_is_24_hours','business_is_closed',
    'default_booking_duration_hours','minimum_booking_duration_minutes',
    'invoice_prefix','invoice_number_mode','default_invoice_due_days','invoice_footer_message','include_logo_on_invoice',
    'membership_year','xero',
    'school_name','schoolName','business_name','businessName','billing_address','billingAddress','address','school_address',
    'contact_email','contactEmail','email_from_address','email_reply_to','invoice_email',
    'contact_phone','contactPhone','phone','invoice_phone',
    'gst_number','gstNumber','tax_number','taxNumber',
    'invoice_footer','invoiceFooter'
  ]::text[] as keys
), cleaned as (
  select
    ts.tenant_id,
    coalesce(
      (
        select jsonb_object_agg(e.key, e.value)
        from jsonb_each(ts.settings) as e(key, value)
        cross join valid_keys vk
        where e.key = any(vk.keys)
      ),
      '{}'::jsonb
    ) as cleaned_settings
  from public.tenant_settings ts
)
update public.tenant_settings ts
set settings = c.cleaned_settings
from cleaned c
where ts.tenant_id = c.tenant_id
  and ts.settings is distinct from c.cleaned_settings;

commit;
