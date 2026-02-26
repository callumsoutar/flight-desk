import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  const { id } = await context.params

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: "Failed to load invoice" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  if (!data) {
    return NextResponse.json(
      { error: "Invoice not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  if (!isStaff(role) && data.user_id !== user.id) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { invoice: data },
    { headers: { "cache-control": "no-store" } }
  )
}
