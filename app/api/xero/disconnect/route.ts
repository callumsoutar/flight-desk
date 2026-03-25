import { NextResponse } from "next/server"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { logWarn } from "@/lib/security/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { revokeXeroToken } from "@/lib/xero/client"
import { getXeroEnv } from "@/lib/xero/env"

export const dynamic = "force-dynamic"

export async function POST() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    includeTenant: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createSupabaseAdminClient()
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

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}
