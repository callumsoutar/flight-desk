import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { AccountStatementEntry, AccountStatementResponse } from "@/lib/types/account-statement"

export const dynamic = "force-dynamic"

function parseDateValue(value: string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER
  const date = new Date(value)
  const ts = date.getTime()
  return Number.isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const userIdParam = request.nextUrl.searchParams.get("user_id")
  const targetUserId = userIdParam ?? user.id

  const canViewOtherMembers = role === "owner" || role === "admin" || role === "instructor"
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: tenantMember, error: tenantMemberError } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", targetUserId)
    .maybeSingle()

  if (tenantMemberError) {
    return NextResponse.json(
      { error: "Failed to validate member access" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  if (!tenantMember) {
    return NextResponse.json(
      { error: "Member not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  const [invoicesResult, paymentsResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, issue_date, invoice_number, reference, total_amount, subtotal, tax_total")
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .is("deleted_at", null),
    supabase
      .from("invoice_payments")
      .select("id, paid_at, amount, payment_method, payment_reference, notes")
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId),
  ])

  if (invoicesResult.error || paymentsResult.error) {
    return NextResponse.json(
      { error: "Failed to load account statement" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  const entries: AccountStatementEntry[] = []

  for (const invoice of invoicesResult.data ?? []) {
    const totalAmount =
      typeof invoice.total_amount === "number"
        ? invoice.total_amount
        : (invoice.subtotal ?? 0) + (invoice.tax_total ?? 0)

    entries.push({
      entry_id: invoice.id,
      entry_type: "invoice",
      date: invoice.issue_date,
      reference: invoice.invoice_number ?? `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
      description: invoice.reference?.trim() || "Invoice",
      amount: totalAmount,
      balance: 0,
    })
  }

  for (const payment of paymentsResult.data ?? []) {
    const methodLabel = payment.payment_method
      .replaceAll("_", " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase())

    entries.push({
      entry_id: payment.id,
      entry_type: "payment",
      date: payment.paid_at,
      reference:
        payment.payment_reference?.trim() || `PAY-${payment.id.slice(0, 8).toUpperCase()}`,
      description: payment.notes?.trim() || `Payment (${methodLabel})`,
      amount: -Math.abs(payment.amount),
      balance: 0,
    })
  }

  entries.sort((a, b) => {
    const diff = parseDateValue(a.date) - parseDateValue(b.date)
    if (diff !== 0) return diff
    if (a.entry_type === b.entry_type) return 0
    if (a.entry_type === "invoice") return -1
    if (b.entry_type === "invoice") return 1
    return 0
  })

  let runningBalance = 0
  const statement = entries.map((entry) => {
    runningBalance += entry.amount
    return {
      ...entry,
      balance: Number(runningBalance.toFixed(2)),
    }
  })

  const payload: AccountStatementResponse = {
    statement,
    closing_balance: Number(runningBalance.toFixed(2)),
  }

  return NextResponse.json(payload, {
    headers: { "cache-control": "no-store" },
  })
}
