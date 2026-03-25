import type { SupabaseClient } from "@supabase/supabase-js"

import { logError } from "@/lib/security/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/types"
import { getXeroEnv } from "@/lib/xero/env"
import { createXeroApiClient, refreshXeroTokens } from "@/lib/xero/client"
import { XeroAuthError } from "@/lib/xero/types"

type AdminClient = SupabaseClient<Database>

type XeroConnectionRow = Database["public"]["Tables"]["xero_connections"]["Row"]

function expiresSoon(tokenExpiresAt: string) {
  const nowMs = Date.now()
  const expiryMs = new Date(tokenExpiresAt).getTime()
  return expiryMs - nowMs <= 5 * 60 * 1000
}

async function refreshIfNeeded(admin: AdminClient, connection: XeroConnectionRow) {
  if (!expiresSoon(connection.token_expires_at)) {
    return connection
  }

  const { clientId, clientSecret } = getXeroEnv()
  try {
    const refreshed = await refreshXeroTokens(connection.refresh_token, clientId, clientSecret)
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

    const patch = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      token_expires_at: expiresAt,
      scopes: refreshed.scope ?? connection.scopes ?? "",
    }

    const { data, error } = await admin
      .from("xero_connections")
      .update(patch)
      .eq("tenant_id", connection.tenant_id)
      .select("*")
      .single()

    if (error || !data) throw error ?? new Error("Failed to persist refreshed token")

    await admin.from("xero_export_logs").insert({
      tenant_id: connection.tenant_id,
      action: "refresh_token",
      status: "success",
      request_payload: { reason: "token_expires_within_5_minutes" },
      response_payload: { token_expires_at: data.token_expires_at },
    })

    return data
  } catch (error) {
    logError("[xero] Token refresh persistence failed", {
      tenantId: connection.tenant_id,
      error: error instanceof Error ? error.message : "Unknown refresh error",
    })
    await admin.from("xero_export_logs").insert({
      tenant_id: connection.tenant_id,
      action: "refresh_token",
      status: "error",
      error_message: error instanceof Error ? error.message : "Unknown refresh error",
    })
    throw new XeroAuthError("Your Xero connection has expired. Please reconnect.")
  }
}

export async function getXeroClient(tenantId: string) {
  const admin = createSupabaseAdminClient()
  const { data: connection, error } = await admin
    .from("xero_connections")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (error) {
    logError("[xero] Failed loading xero connection", { tenantId, error: error.message })
    throw error
  }
  if (!connection) {
    throw new XeroAuthError("Xero is not connected for this tenant.")
  }

  const currentConnection = await refreshIfNeeded(admin, connection)
  const client = createXeroApiClient(currentConnection.access_token, currentConnection.xero_tenant_id)

  return {
    admin,
    client,
    connection: currentConnection,
    xeroTenantId: currentConnection.xero_tenant_id,
  }
}
