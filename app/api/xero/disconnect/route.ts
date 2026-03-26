import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { logWarn } from "@/lib/security/logger"
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged"
import { revokeXeroToken } from "@/lib/xero/client"
import { getXeroEnv } from "@/lib/xero/env"

export const dynamic = "force-dynamic"

export async function POST() {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { user, tenantId } = session.context

  const admin = createPrivilegedSupabaseClient("disconnect Xero tenant connection and reset integration settings")
  const { data: connection } = await admin
    .from("xero_connections")
    .select("refresh_token")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (connection?.refresh_token) {
    try {
      const { clientId, clientSecret } = getXeroEnv()
      await revokeXeroToken(connection.refresh_token, clientId, clientSecret)
    } catch (error) {
      logWarn("[xero] revoke failed during disconnect", { error, tenantId })
    }
  }

  await admin.from("xero_connections").delete().eq("tenant_id", tenantId)

  const { data: settingsRow } = await admin
    .from("tenant_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  const existing =
    settingsRow?.settings && typeof settingsRow.settings === "object" && !Array.isArray(settingsRow.settings)
      ? (settingsRow.settings as Record<string, unknown>)
      : {}

  const currentXero =
    existing.xero && typeof existing.xero === "object" && !Array.isArray(existing.xero)
      ? (existing.xero as Record<string, unknown>)
      : {}

  const nextSettings = {
    ...existing,
    xero: {
      ...currentXero,
      enabled: false,
    },
  }

  if (settingsRow) {
    await admin.from("tenant_settings").update({ settings: nextSettings }).eq("tenant_id", tenantId)
  } else {
    await admin.from("tenant_settings").insert({ tenant_id: tenantId, settings: nextSettings })
  }

  await admin.from("xero_export_logs").insert({
    tenant_id: tenantId,
    action: "disconnect",
    status: "success",
    initiated_by: user.id,
  })

  return noStoreJson({ ok: true })
}
