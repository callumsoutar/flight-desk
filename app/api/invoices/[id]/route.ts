import { NextRequest, NextResponse } from "next/server"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { getEffectiveInvoiceStatus } from "@/lib/invoices/effective-status"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    includeTenant: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

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

  if (!isStaffRole(role) && data.user_id !== user.id) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const invoice = {
    ...data,
    status: getEffectiveInvoiceStatus({
      status: data.status,
      dueDate: data.due_date,
      balanceDue: data.balance_due,
    }),
  }

  return NextResponse.json(
    { invoice },
    { headers: { "cache-control": "no-store" } }
  )
}
