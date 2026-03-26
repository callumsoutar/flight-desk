import { NextRequest, NextResponse } from "next/server"

import { getRequiredApiSession } from "@/lib/auth/api-session"
import { isStaffRole } from "@/lib/auth/roles"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
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

  const invoiceId = request.nextUrl.searchParams.get("invoice_id")
  if (!invoiceId) {
    return NextResponse.json(
      { error: "invoice_id is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, user_id")
    .eq("tenant_id", tenantId)
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (invoiceError) {
    return NextResponse.json(
      { error: "Failed to load invoice" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  if (!invoice) {
    return NextResponse.json(
      { error: "Invoice not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  if (!isStaffRole(role) && invoice.user_id !== user.id) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const { data, error } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("invoice_id", invoiceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: "Failed to load invoice items" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { invoice_items: data ?? [] },
    { headers: { "cache-control": "no-store" } }
  )
}
