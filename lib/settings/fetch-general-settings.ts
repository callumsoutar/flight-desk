import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveBusinessHours, type GeneralSettings } from "@/lib/settings/general-settings"
import { resolveTenantLogoSignedUrl } from "@/lib/settings/logo-storage-admin"
import type { Database } from "@/lib/types"

export async function fetchGeneralSettings(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<GeneralSettings> {
  const [tenantResult, tenantSettingsResult] = await Promise.all([
    supabase
      .from("tenants")
      .select(
        "name, registration_number, description, website_url, logo_url, contact_email, contact_phone, address, billing_address, gst_number, timezone, currency"
      )
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
  if (!tenant) {
    return {
      tenant: {
        name: "Company",
        registration_number: null,
        description: null,
        website_url: null,
        logo_url: null,
        contact_email: null,
        contact_phone: null,
        address: null,
        billing_address: null,
        gst_number: null,
        timezone: null,
        currency: null,
      },
      businessHours: resolveBusinessHours(null),
    }
  }

  const logoUrl = await resolveTenantLogoSignedUrl(tenant.logo_url ?? null)

  return {
    tenant: {
      name: tenant.name,
      registration_number: tenant.registration_number ?? null,
      description: tenant.description ?? null,
      website_url: tenant.website_url ?? null,
      logo_url: logoUrl,
      contact_email: tenant.contact_email ?? null,
      contact_phone: tenant.contact_phone ?? null,
      address: tenant.address ?? null,
      billing_address: tenant.billing_address ?? null,
      gst_number: tenant.gst_number ?? null,
      timezone: tenant.timezone ?? null,
      currency: tenant.currency ?? null,
    },
    businessHours: resolveBusinessHours(tenantSettingsResult.data?.settings ?? null),
  }
}
