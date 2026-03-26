import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { getXeroEnv } from "@/lib/xero/env"

export const dynamic = "force-dynamic"

type XeroStatePayload = {
  tenantId: string
  nonce: string
  timestamp: number
}

function encodeStatePayload(payload: XeroStatePayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

export async function GET(request: NextRequest) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { tenantId } = session.context

  const { clientId, redirectUri, scopes } = getXeroEnv()
  const nonce = randomUUID()
  const payload = { tenantId, nonce, timestamp: Date.now() }
  const encodedState = encodeStatePayload(payload)

  const cookieStore = await cookies()
  cookieStore.set("xero_oauth_state", encodedState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  })

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state: encodedState,
  })

  const authorizeUrl = `https://login.xero.com/identity/connect/authorize?${params.toString()}`

  // ?debug=1 returns troubleshoot info instead of redirecting (admin only, dev only)
  if (process.env.NODE_ENV === "development" && request.nextUrl.searchParams.get("debug") === "1") {
    return noStoreJson({
      message: "Xero OAuth debug — verify these match your Xero app",
      client_id: clientId,
      client_id_length: clientId.length,
      redirect_uri: redirectUri,
      scope: scopes,
      authorize_url: authorizeUrl,
      checklist: [
        "Xero Developer Portal → Your app → Redirect URIs must contain EXACTLY: " + redirectUri,
        "No trailing slash, no extra path. Character-for-character match.",
        "Client ID above must match the app you created.",
      ],
    })
  }

  return NextResponse.redirect(authorizeUrl)
}
