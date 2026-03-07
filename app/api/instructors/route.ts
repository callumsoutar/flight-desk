import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, { includeRole: true, includeTenant: true })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Account not configured" },
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
    .from("instructors")
    .select(
      "id, user_id, first_name, last_name, status, is_actively_instructing, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)"
    )
    .eq("tenant_id", tenantId)
    .eq("is_actively_instructing", true)
    .order("first_name", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: "Failed to load instructors" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { instructors: data ?? [] },
    { headers: { "cache-control": "no-store" } }
  )
}

