import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { InvoiceEmailNotificationSummary } from "@/lib/email/email-notification-summary-types"
import { fetchInvoiceEmailNotificationSummary } from "@/lib/email/fetch-email-notification-summaries"
import type { Database, InvoiceItemsRow } from "@/lib/types"
import type { InvoiceWithRelations } from "@/lib/types/invoices"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export type InvoiceDetailData = {
  invoice: InvoiceWithRelations | null
  items: InvoiceItemsRow[]
  xeroStatus: {
    export_status: Database["public"]["Enums"]["xero_export_status"]
    xero_invoice_id: string | null
    exported_at: string | null
    error_message: string | null
  } | null
  emailNotificationSummary: InvoiceEmailNotificationSummary
}

export async function fetchInvoiceDetail(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  invoiceId: string
): Promise<InvoiceDetailData> {
  const [invoiceResult, itemResult, xeroStatusResult, emailNotificationSummary] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, user:user_directory!invoices_user_id_fkey(id, first_name, last_name, email)")
      .eq("tenant_id", tenantId)
      .eq("id", invoiceId)
      .maybeSingle(),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true }),
    supabase
      .from("xero_invoices")
      .select("export_status, xero_invoice_id, exported_at, error_message")
      .eq("tenant_id", tenantId)
      .eq("invoice_id", invoiceId)
      .maybeSingle(),
    fetchInvoiceEmailNotificationSummary(supabase, tenantId, invoiceId),
  ])

  if (invoiceResult.error) throw invoiceResult.error
  if (itemResult.error) throw itemResult.error
  if (xeroStatusResult.error) throw xeroStatusResult.error

  const invoice = invoiceResult.data
    ? ({
        ...invoiceResult.data,
        user: pickMaybeOne(invoiceResult.data.user),
      } as InvoiceWithRelations)
    : null

  return {
    invoice,
    items: invoice ? (itemResult.data ?? []) : [],
    xeroStatus: xeroStatusResult.data ?? null,
    emailNotificationSummary,
  }
}
