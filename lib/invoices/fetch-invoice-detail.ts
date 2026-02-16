import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, InvoiceItemsRow } from "@/lib/types"
import type { InvoiceWithRelations } from "@/lib/types/invoices"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export type InvoiceDetailData = {
  invoice: InvoiceWithRelations | null
  items: InvoiceItemsRow[]
}

export async function fetchInvoiceDetail(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  invoiceId: string
): Promise<InvoiceDetailData> {
  const { data: invoiceData, error: invoiceError } = await supabase
    .from("invoices")
    .select("*, user:user_directory!invoices_user_id_fkey(id, first_name, last_name, email)")
    .eq("tenant_id", tenantId)
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (invoiceError) throw invoiceError

  const invoice = invoiceData
    ? ({
        ...invoiceData,
        user: pickMaybeOne(invoiceData.user),
      } as InvoiceWithRelations)
    : null

  if (!invoice) {
    return {
      invoice: null,
      items: [],
    }
  }

  const { data: itemData, error: itemError } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("invoice_id", invoice.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (itemError) throw itemError

  return {
    invoice,
    items: itemData ?? [],
  }
}
