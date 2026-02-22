import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  DEFAULT_INVOICING_SETTINGS,
  resolveInvoicingSettings,
  type InvoicingSettings,
} from "@/lib/invoices/invoicing-settings"
import type { Database } from "@/lib/types"

export async function fetchInvoicingSettings(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<InvoicingSettings> {
  const [tenantResult, tenantSettingsResult] = await Promise.all([
    supabase
      .from("tenants")
      .select("name, billing_address, address, contact_email, contact_phone, gst_number, settings")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("tenant_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ])

  if (tenantResult.error) throw tenantResult.error
  if (tenantSettingsResult.error) throw tenantSettingsResult.error

  const tenant = tenantResult.data
  if (!tenant) return DEFAULT_INVOICING_SETTINGS

  return resolveInvoicingSettings({
    tenantName: tenant.name ?? null,
    tenantBillingAddress: tenant.billing_address ?? null,
    tenantAddress: tenant.address ?? null,
    tenantContactEmail: tenant.contact_email ?? null,
    tenantContactPhone: tenant.contact_phone ?? null,
    tenantGstNumber: tenant.gst_number ?? null,
    tenantSettings: tenantSettingsResult.data?.settings ?? null,
    legacyTenantSettings: tenant.settings ?? null,
  })
}
