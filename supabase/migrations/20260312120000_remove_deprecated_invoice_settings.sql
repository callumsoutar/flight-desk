-- Migration: remove deprecated invoice settings from tenant_settings.settings
-- These settings (payment terms, late fee, auto_generate_invoices, reminder days) have been
-- removed from the invoicing settings UI and backend. Strip them from existing tenant data.
UPDATE public.tenant_settings
SET settings = settings
  - 'payment_terms_days'
  - 'payment_terms_message'
  - 'late_fee_percentage'
  - 'auto_generate_invoices'
  - 'invoice_due_reminder_days'
WHERE settings ?| array['payment_terms_days', 'payment_terms_message', 'late_fee_percentage', 'auto_generate_invoices', 'invoice_due_reminder_days'];
