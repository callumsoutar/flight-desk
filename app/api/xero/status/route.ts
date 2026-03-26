import { NextResponse } from "next/server"

import { getRequiredApiSession } from "@/lib/auth/api-session"
import { isStaffRole } from "@/lib/auth/roles"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { fetchXeroSettings } from "@/lib/settings/fetch-xero-settings"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getRequiredApiSession(supabase, { includeRole: true })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  if (!isStaffRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const [{ data: connection, error }, settings] = await Promise.all([
    supabase
      .from("xero_connections")
      .select("xero_tenant_name, created_at")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    fetchXeroSettings(supabase, tenantId),
  ])

  if (error) return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 })

  return NextResponse.json(
    {
      connected: Boolean(connection),
      xero_tenant_name: connection?.xero_tenant_name ?? null,
      connected_at: settings.connected_at ?? connection?.created_at ?? null,
      enabled: settings.enabled,
    },
    { headers: { "cache-control": "no-store" } }
  )
}
