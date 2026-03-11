import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/lib/types"

type TypedClient = SupabaseClient<Database>

export async function voidAndReissueXeroInvoice(
  supabase: TypedClient,
  invoiceId: string,
  reason: string
) {
  return supabase.rpc("void_and_reissue_xero_invoice", {
    p_invoice_id: invoiceId,
    p_reason: reason,
  })
}

export async function reverseInvoicePayment(
  supabase: TypedClient,
  paymentId: string,
  reason: string
) {
  return supabase.rpc("reverse_invoice_payment_atomic", {
    p_payment_id: paymentId,
    p_reason: reason,
  })
}

export async function adminCorrectInvoice(
  supabase: TypedClient,
  invoiceId: string,
  changes: Record<string, Json | undefined>,
  reason: string
) {
  return supabase.rpc("admin_correct_invoice", {
    p_invoice_id: invoiceId,
    p_changes: changes as unknown as Json,
    p_reason: reason,
  })
}

export async function isInvoiceXeroExported(
  supabase: TypedClient,
  invoiceId: string
) {
  return supabase.rpc("invoice_is_xero_exported", {
    p_invoice_id: invoiceId,
  })
}
