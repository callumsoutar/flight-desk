import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { AuditLogsRow } from "@/lib/types/tables"

export type InvoiceAuditLog = AuditLogsRow & {
  user: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
}

export type InvoiceAuditLookupMaps = {
  users: Record<string, string>
}

const HISTORY_LIMIT = 200

export async function fetchInvoiceAuditLogs(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  invoiceId: string,
): Promise<{ logs: InvoiceAuditLog[]; maps: InvoiceAuditLookupMaps }> {
  // 1. Pull audit rows for the invoice itself, plus its items and payments.
  //    invoice_items / invoice_payments audit rows have their own record_id
  //    (the item / payment id), so we filter on the embedded invoice_id inside
  //    new_data and old_data using two separate queries per child table and
  //    dedupe in JS. This avoids relying on JSONB syntax inside `.or()`.
  const childTableQuery = (table: "invoice_items" | "invoice_payments", column: "new_data" | "old_data") =>
    supabase
      .from("audit_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("table_name", table)
      .filter(`${column}->>invoice_id`, "eq", invoiceId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT)

  const [
    invoiceLogsResult,
    itemNewLogsResult,
    itemOldLogsResult,
    paymentNewLogsResult,
    paymentOldLogsResult,
  ] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("table_name", "invoices")
      .eq("record_id", invoiceId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    childTableQuery("invoice_items", "new_data"),
    childTableQuery("invoice_items", "old_data"),
    childTableQuery("invoice_payments", "new_data"),
    childTableQuery("invoice_payments", "old_data"),
  ])

  if (invoiceLogsResult.error) throw invoiceLogsResult.error
  if (itemNewLogsResult.error) throw itemNewLogsResult.error
  if (itemOldLogsResult.error) throw itemOldLogsResult.error
  if (paymentNewLogsResult.error) throw paymentNewLogsResult.error
  if (paymentOldLogsResult.error) throw paymentOldLogsResult.error

  const dedupeById = (rows: AuditLogsRow[]): AuditLogsRow[] => {
    const seen = new Set<string>()
    const out: AuditLogsRow[] = []
    for (const row of rows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push(row)
    }
    return out
  }

  const rawLogs: AuditLogsRow[] = dedupeById([
    ...(invoiceLogsResult.data ?? []),
    ...(itemNewLogsResult.data ?? []),
    ...(itemOldLogsResult.data ?? []),
    ...(paymentNewLogsResult.data ?? []),
    ...(paymentOldLogsResult.data ?? []),
  ]).sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return bTime - aTime
  })

  // 2. Build the user lookup map for change authors.
  const userIds = new Set<string>()
  for (const log of rawLogs) {
    if (log.user_id) userIds.add(log.user_id)
  }

  type UserRow = {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
  }

  let userRows: UserRow[] = []
  if (userIds.size > 0) {
    const { data, error } = await supabase
      .from("user_directory")
      .select("id, first_name, last_name, email")
      .in("id", Array.from(userIds))

    if (error) throw error
    userRows = (data ?? []) as UserRow[]
  }

  const userMap = new Map<string, UserRow>()
  for (const u of userRows) {
    if (u.id) userMap.set(u.id, u)
  }

  const formatName = (
    first: string | null,
    last: string | null,
    fallback: string,
  ): string => [first, last].filter(Boolean).join(" ") || fallback

  const usersLookup: Record<string, string> = {}
  for (const u of userRows) {
    usersLookup[u.id] = formatName(u.first_name, u.last_name, u.email ?? "Unknown")
  }

  const logs: InvoiceAuditLog[] = rawLogs.map((row) => ({
    ...row,
    user: row.user_id ? (userMap.get(row.user_id) ?? null) : null,
  }))

  return {
    logs,
    maps: { users: usersLookup },
  }
}
