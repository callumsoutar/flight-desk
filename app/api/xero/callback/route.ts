import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

import { getTenantAdminRouteContext } from "@/lib/api/tenant-route"
import { logError } from "@/lib/security/logger"
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged"
import { exchangeCodeForTokens, fetchXeroConnections } from "@/lib/xero/client"
import { getXeroEnv } from "@/lib/xero/env"

export const dynamic = "force-dynamic"

type DecodedState = {
  nonce: string
  timestamp: number
}

const XERO_STATE_MAX_AGE_MS = 10 * 60 * 1000

function decodeState(value: string): DecodedState | null {
  try {
    const raw = Buffer.from(value, "base64url").toString("utf8")
    const parsed = JSON.parse(raw) as Partial<DecodedState>
    if (
      typeof parsed?.nonce === "string" &&
      typeof parsed?.timestamp === "number" &&
      Number.isFinite(parsed.timestamp)
    ) {
      return parsed as DecodedState
    }
    return null
  } catch {
    return null
  }
}

function integrationRedirect(status: string, message?: string) {
  const params = new URLSearchParams({ tab: "integrations", xero: status })
  if (message) params.set("message", message)
  return `/settings?${params.toString()}`
}

function redirectFromRouteContextError(response: Response, request: NextRequest) {
  const message =
    response.status === 400
      ? "account_not_configured"
      : response.status === 403
        ? "forbidden"
        : "unauthorized"

  return NextResponse.redirect(new URL(integrationRedirect("error", message), request.url))
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const cookieStore = await cookies()
  const storedState = cookieStore.get("xero_oauth_state")?.value

  cookieStore.delete("xero_oauth_state")

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL(integrationRedirect("error", "invalid_state"), request.url))
  }

  const decoded = decodeState(state)
  if (!decoded) {
    return NextResponse.redirect(new URL(integrationRedirect("error", "invalid_state_payload"), request.url))
  }

  const stateAgeMs = Date.now() - decoded.timestamp
  if (stateAgeMs < 0 || stateAgeMs > XERO_STATE_MAX_AGE_MS) {
    return NextResponse.redirect(new URL(integrationRedirect("error", "stale_state"), request.url))
  }

  try {
    const session = await getTenantAdminRouteContext()
    if (session.response) return redirectFromRouteContextError(session.response, request)
    const { user, tenantId } = session.context

    const { clientId, clientSecret, redirectUri } = getXeroEnv()
    const tokens = await exchangeCodeForTokens(code, redirectUri, clientId, clientSecret)
    const connections = await fetchXeroConnections(tokens.access_token)
    const connection = connections[0]
    const xeroTenantId = connection?.tenantId ?? connection?.id
    if (!xeroTenantId) {
      return NextResponse.redirect(new URL(integrationRedirect("error", "no_xero_tenant"), request.url))
    }

    const admin = createPrivilegedSupabaseClient("persist Xero OAuth connection tokens and tenant integration state")
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const { error: upsertConnectionError } = await admin.from("xero_connections").upsert(
      {
        tenant_id: tenantId,
        xero_tenant_id: xeroTenantId,
        xero_tenant_name: connection.tenantName ?? null,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokenExpiresAt,
        scopes: tokens.scope ?? "",
        connected_by: user.id,
      },
      { onConflict: "tenant_id" }
    )
    if (upsertConnectionError) throw upsertConnectionError

    const { data: settingsRow, error: settingsFetchError } = await admin
      .from("tenant_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle()
    if (settingsFetchError) throw settingsFetchError

    const existing =
      settingsRow?.settings && typeof settingsRow.settings === "object" && !Array.isArray(settingsRow.settings)
        ? (settingsRow.settings as Record<string, unknown>)
        : {}

    const xeroSettings =
      existing.xero && typeof existing.xero === "object" && !Array.isArray(existing.xero)
        ? (existing.xero as Record<string, unknown>)
        : {}

    const nextSettings = {
      ...existing,
      xero: {
        ...xeroSettings,
        enabled: true,
        connected_at: new Date().toISOString(),
      },
    }

    if (settingsRow) {
      const { error: settingsUpdateError } = await admin
        .from("tenant_settings")
        .update({ settings: nextSettings })
        .eq("tenant_id", tenantId)
      if (settingsUpdateError) throw settingsUpdateError
    } else {
      const { error: settingsInsertError } = await admin.from("tenant_settings").insert({
        tenant_id: tenantId,
        settings: nextSettings,
      })
      if (settingsInsertError) throw settingsInsertError
    }

    const { error: exportLogError } = await admin.from("xero_export_logs").insert({
      tenant_id: tenantId,
      action: "connect",
      status: "success",
      initiated_by: user.id,
      request_payload: { scope: tokens.scope ?? "" },
      response_payload: { xero_tenant_id: xeroTenantId, xero_tenant_name: connection.tenantName ?? null },
    })
    if (exportLogError) throw exportLogError

    return NextResponse.redirect(new URL(integrationRedirect("connected"), request.url))
  } catch (error) {
    logError("[xero] OAuth callback failed", {
      error: error instanceof Error ? error.message : "callback_failed",
    })
    return NextResponse.redirect(
      new URL(integrationRedirect("error", "connection_failed"), request.url)
    )
  }
}
