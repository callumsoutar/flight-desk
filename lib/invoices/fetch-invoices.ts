import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type {
  InvoicesFilter,
  InvoiceStatus,
  InvoiceWithRelations,
} from "@/lib/types/invoices"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function normalizeSearch(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized ? normalized : null
}

function isValidDate(value: string | undefined) {
  if (!value) return false
  return !Number.isNaN(new Date(value).getTime())
}

function matchStatus(status: InvoiceStatus, filters?: InvoicesFilter) {
  if (!filters?.status || filters.status.length === 0) return true
  return filters.status.includes(status)
}

function matchSearch(invoice: InvoiceWithRelations, normalizedSearch: string | null) {
  if (!normalizedSearch) return true

  const fullName = `${invoice.user?.first_name ?? ""} ${invoice.user?.last_name ?? ""}`
    .trim()
    .toLowerCase()

  return (
    (invoice.invoice_number ?? "").toLowerCase().includes(normalizedSearch) ||
    (invoice.reference ?? "").toLowerCase().includes(normalizedSearch) ||
    (invoice.user?.email ?? "").toLowerCase().includes(normalizedSearch) ||
    fullName.includes(normalizedSearch)
  )
}

export async function fetchInvoices(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  filters?: InvoicesFilter,
  xeroEnabled = false
): Promise<InvoiceWithRelations[]> {
  let query = supabase
    .from("invoices")
    .select(
      "*, user:user_directory!invoices_user_id_fkey(id, first_name, last_name, email)"
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })

  if (filters?.user_id) {
    query = query.eq("user_id", filters.user_id)
  }

  if (isValidDate(filters?.start_date)) {
    query = query.gte("issue_date", filters!.start_date!)
  }

  if (isValidDate(filters?.end_date)) {
    query = query.lte("issue_date", filters!.end_date!)
  }

  if (filters?.status?.length) {
    query = query.in("status", filters.status)
  }

  const { data, error } = await query
  if (error) throw error

  const normalized = (data ?? []).map<InvoiceWithRelations>((row) => ({
    ...row,
    user: pickMaybeOne(row.user),
  }))

  if (xeroEnabled && normalized.length > 0) {
    const invoiceIds = normalized.map((invoice) => invoice.id)
    const { data: xeroStatuses } = await supabase
      .from("xero_invoices")
      .select("invoice_id, export_status, xero_invoice_id, exported_at, error_message")
      .eq("tenant_id", tenantId)
      .in("invoice_id", invoiceIds)

    const statusMap = new Map((xeroStatuses ?? []).map((row) => [row.invoice_id, row]))
    for (const invoice of normalized) {
      const status = statusMap.get(invoice.id)
      invoice.xero_export_status = status?.export_status ?? null
      invoice.xero_invoice_id = status?.xero_invoice_id ?? null
      invoice.xero_exported_at = status?.exported_at ?? null
      invoice.xero_error_message = status?.error_message ?? null
    }
  }

  const normalizedSearch = normalizeSearch(filters?.search)

  return normalized.filter((invoice) => {
    if (!matchStatus(invoice.status, filters)) return false
    if (!matchSearch(invoice, normalizedSearch)) return false
    return true
  })
}
