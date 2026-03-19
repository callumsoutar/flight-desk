import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  DEFAULT_INVOICING_SETTINGS,
  resolveInvoicingSettings,
  type InvoicingSettings,
} from "@/lib/invoices/invoicing-settings"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { TENANT_LOGO_BUCKET, isProbablyUrl } from "@/lib/settings/logo-storage"
import { isJsonObject } from "@/lib/settings/utils"
import type { Database } from "@/lib/types"

export async function fetchInvoicingSettings(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<InvoicingSettings> {
  const [tenantResult, tenantSettingsResult] = await Promise.all([
    supabase
      .from("tenants")
      .select("name, billing_address, address, contact_email, contact_phone, gst_number, logo_url")
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

  const rawSettings = tenantSettingsResult.data?.settings ?? null
  const includeLogoOnInvoice =
    isJsonObject(rawSettings) && rawSettings["include_logo_on_invoice"] === true

  let tenantLogoUrl: string | null = null
  if (includeLogoOnInvoice && typeof tenant.logo_url === "string" && tenant.logo_url) {
    const raw = tenant.logo_url
    if (isProbablyUrl(raw)) {
      tenantLogoUrl = raw
    } else {
      try {
        const adminClient = createSupabaseAdminClient()
        const { data } = await adminClient.storage
          .from(TENANT_LOGO_BUCKET)
          .createSignedUrl(raw, 60 * 60 * 24 * 30)
        tenantLogoUrl = data?.signedUrl ?? null
      } catch {
        tenantLogoUrl = null
      }
    }
  }

  return resolveInvoicingSettings({
    tenantName: tenant.name ?? null,
    tenantBillingAddress: tenant.billing_address ?? null,
    tenantAddress: tenant.address ?? null,
    tenantContactEmail: tenant.contact_email ?? null,
    tenantContactPhone: tenant.contact_phone ?? null,
    tenantGstNumber: tenant.gst_number ?? null,
    tenantSettings: rawSettings,
    tenantLogoUrl,
  })
}
