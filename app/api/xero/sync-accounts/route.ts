import { NextResponse } from "next/server"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { logError } from "@/lib/security/logger"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { syncXeroAccounts } from "@/lib/xero/sync-accounts"

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

  try {
    const result = await syncXeroAccounts(tenantId, user.id)
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } })
  } catch (error) {
    logError("[xero] Account sync endpoint failed", { error, tenantId, userId: user.id })
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
