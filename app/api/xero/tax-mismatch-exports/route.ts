import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isAdmin(role: string | null) {
  return role === "owner" || role === "admin"
}

function requestPayloadUsesOnlyNoneTaxTypes(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false
  const lineItems = (payload as { LineItems?: unknown }).LineItems
  if (!Array.isArray(lineItems) || lineItems.length === 0) return false
  return lineItems.every((lineItem) => {
    if (!lineItem || typeof lineItem !== "object" || Array.isArray(lineItem)) return false
    return (lineItem as { TaxType?: unknown }).TaxType === "NONE"
  })
}

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
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

  const { data: exportedInvoices, error: exportedInvoicesError } = await supabase
    .from("xero_invoices")
    .select(
      "invoice_id, xero_invoice_id, exported_at, invoice:invoices!inner(id, invoice_number, tax_total, total_amount, issue_date)"
    )
    .eq("tenant_id", tenantId)
    .eq("export_status", "exported")
    .gt("invoice.tax_total", 0)
    .order("exported_at", { ascending: false })
    .limit(200)

  if (exportedInvoicesError) {
    return NextResponse.json({ error: "Failed to query exported invoices" }, { status: 500 })
  }

  const invoiceIds = (exportedInvoices ?? []).map((row) => row.invoice_id)
  if (invoiceIds.length === 0) {
    return NextResponse.json({ mismatches: [] }, { headers: { "cache-control": "no-store" } })
  }

  const { data: exportLogs, error: exportLogsError } = await supabase
    .from("xero_export_logs")
    .select("invoice_id, created_at, request_payload")
    .eq("tenant_id", tenantId)
    .eq("action", "export_invoice")
    .eq("status", "success")
    .in("invoice_id", invoiceIds)
    .order("created_at", { ascending: false })

  if (exportLogsError) {
    return NextResponse.json({ error: "Failed to query export logs" }, { status: 500 })
  }

  const latestLogByInvoiceId = new Map<string, (typeof exportLogs)[number]>()
  for (const log of exportLogs ?? []) {
    if (!log.invoice_id || latestLogByInvoiceId.has(log.invoice_id)) continue
    latestLogByInvoiceId.set(log.invoice_id, log)
  }

  const mismatches = (exportedInvoices ?? []).reduce<
    Array<{
      invoice_id: string
      xero_invoice_id: string | null
      exported_at: string | null
      invoice_number: string | null
      issue_date: string
      tax_total: number
      total_amount: number
    }>
  >((acc, row) => {
    const invoice = pickMaybeOne(row.invoice)
    if (!invoice || Number(invoice.tax_total ?? 0) <= 0) return acc

    const log = latestLogByInvoiceId.get(row.invoice_id)
    if (!log || !requestPayloadUsesOnlyNoneTaxTypes(log.request_payload)) return acc

    acc.push({
      invoice_id: row.invoice_id,
      xero_invoice_id: row.xero_invoice_id,
      exported_at: row.exported_at,
      invoice_number: invoice.invoice_number,
      issue_date: invoice.issue_date,
      tax_total: Number(invoice.tax_total ?? 0),
      total_amount: Number(invoice.total_amount ?? 0),
    })
    return acc
  }, [])

  return NextResponse.json({ mismatches }, { headers: { "cache-control": "no-store" } })
}
