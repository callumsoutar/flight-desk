import { z } from "zod"

import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchXeroSettings } from "@/lib/settings/fetch-xero-settings"
import { isJsonObject, normalizeNullableString } from "@/lib/settings/utils"
import type { Json } from "@/lib/types"

export const dynamic = "force-dynamic"

const patchSchema = z.strictObject({
  xero: z.strictObject({
    default_revenue_account_code: z.string().trim().max(20).nullable().optional(),
    default_tax_type: z.string().trim().max(40).nullable().optional(),
    auto_export_on_approve: z.boolean().optional(),
  }),
})

export async function GET() {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  try {
    const settings = await fetchXeroSettings(supabase, tenantId)
    return noStoreJson({ settings })
  } catch {
    return noStoreJson({ error: "Failed to load Xero settings" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, user, tenantId } = session.context

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return noStoreJson({ error: "Invalid payload" }, { status: 400 })

  const { data: row, error: readError } = await supabase
    .from("tenant_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (readError) return noStoreJson({ error: "Failed to load existing settings" }, { status: 500 })

  const existing = isJsonObject(row?.settings) ? row.settings : {}
  const existingXero = isJsonObject(existing.xero) ? existing.xero : {}

  const patch = parsed.data.xero
  const normalizedDefaultRevenueAccountCode = normalizeNullableString(patch.default_revenue_account_code)
  const normalizedDefaultTaxType = normalizeNullableString(patch.default_tax_type)?.toUpperCase() ?? null

  if (patch.default_revenue_account_code !== undefined && normalizedDefaultRevenueAccountCode) {
    const { data: account, error: accountError } = await supabase
      .from("xero_accounts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE")
      .eq("code", normalizedDefaultRevenueAccountCode)
      .maybeSingle()
    if (accountError) {
      return noStoreJson({ error: "Failed to validate default revenue account" }, { status: 500 })
    }
    if (!account) {
      return noStoreJson(
        { error: "Default revenue account must match an active synced Xero account code" },
        { status: 422 }
      )
    }
  }

  const nextXero: Record<string, Json> = {
    ...existingXero,
  }

  if (patch.default_revenue_account_code !== undefined) {
    nextXero.default_revenue_account_code = normalizedDefaultRevenueAccountCode
  }
  if (patch.default_tax_type !== undefined) {
    nextXero.default_tax_type = normalizedDefaultTaxType
  }
  if (patch.auto_export_on_approve !== undefined) {
    nextXero.auto_export_on_approve = patch.auto_export_on_approve
  }

  const nextSettings = {
    ...existing,
    xero: nextXero,
  }

  if (row) {
    const { error: updateError } = await supabase
      .from("tenant_settings")
      .update({ settings: nextSettings, updated_by: user.id })
      .eq("tenant_id", tenantId)
    if (updateError) return noStoreJson({ error: "Failed to update settings" }, { status: 500 })
  } else {
    const { error: insertError } = await supabase.from("tenant_settings").insert({
      tenant_id: tenantId,
      settings: nextSettings,
      updated_by: user.id,
    })
    if (insertError) return noStoreJson({ error: "Failed to save settings" }, { status: 500 })
  }

  const settings = await fetchXeroSettings(supabase, tenantId)
  return noStoreJson({ settings })
}
