import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getXeroEnv } from "@/lib/xero/env"

export const dynamic = "force-dynamic"

function isAdmin(role: string | null) {
  return role === "owner" || role === "admin"
}

type XeroStatePayload = {
  tenantId: string
  nonce: string
  timestamp: number
}

function encodeStatePayload(payload: XeroStatePayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

export async function GET() {
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
  if (!isAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { clientId, redirectUri } = getXeroEnv()
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
    scope:
      "openid profile email accounting.transactions accounting.contacts accounting.settings offline_access",
    state: encodedState,
  })

  return NextResponse.redirect(
    `https://login.xero.com/identity/connect/authorize?${params.toString()}`
  )
}
