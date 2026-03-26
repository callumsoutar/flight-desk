import { NextResponse } from "next/server"

import { getRequiredApiSession } from "@/lib/auth/api-session"
import { isStaffRole } from "@/lib/auth/roles"
import { fetchInvoiceCreateData } from "@/lib/invoices/fetch-invoice-create-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getRequiredApiSession(supabase, { includeRole: true })

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

  if (!isStaffRole(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const createData = await fetchInvoiceCreateData(supabase, tenantId)
    return NextResponse.json(
      { members: createData.members },
      { headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to load members" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
