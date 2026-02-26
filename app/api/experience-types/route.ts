import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  if (!isStaff(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const { data, error } = await supabase
    .from("experience_types")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .is("voided_at", null)
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: "Failed to load experience types" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { experience_types: data ?? [] },
    { headers: { "cache-control": "no-store" } }
  )
}
