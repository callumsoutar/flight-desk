import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"

export type InvoicePaymentRow = {
  id: string
  invoice_id: string
  amount: number
  payment_method: Database["public"]["Enums"]["payment_method"]
  payment_reference: string | null
  notes: string | null
  paid_at: string
  transaction_id: string
  created_by: string
  created_at: string
  reversed_at: string | null
  reversal_transaction_id: string | null
  reversal_reason: string | null
  created_by_name: string | null
}

type ReversalMetaRow = {
  id: string
  completed_at: string | null
  metadata: { original_payment_id?: string; reversal_reason?: string } | null
}

export async function fetchInvoicePayments(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  invoiceId: string,
): Promise<InvoicePaymentRow[]> {
  const { data: payments, error } = await supabase
    .from("invoice_payments")
    .select(
      "id, invoice_id, amount, payment_method, payment_reference, notes, paid_at, transaction_id, created_by, created_at",
    )
    .eq("tenant_id", tenantId)
    .eq("invoice_id", invoiceId)
    .order("paid_at", { ascending: false })

  if (error) throw error
  if (!payments || payments.length === 0) return []

  const paymentIds = payments.map((p) => p.id)
  const creatorIds = Array.from(new Set(payments.map((p) => p.created_by)))

  const [reversalsResult, creatorsResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, completed_at, metadata")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .eq("metadata->>transaction_type", "payment_reversal")
      .in("metadata->>original_payment_id", paymentIds),
    creatorIds.length > 0
      ? supabase
          .from("user_directory")
          .select("id, first_name, last_name, email")
          .in("id", creatorIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (reversalsResult.error) throw reversalsResult.error
  if (creatorsResult.error) throw creatorsResult.error

  const reversalsByPaymentId = new Map<string, ReversalMetaRow>()
  for (const row of (reversalsResult.data ?? []) as ReversalMetaRow[]) {
    const originalPaymentId = row.metadata?.original_payment_id
    if (originalPaymentId) reversalsByPaymentId.set(originalPaymentId, row)
  }

  const creatorById = new Map<string, string>()
  for (const row of creatorsResult.data ?? []) {
    if (!row.id) continue
    const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim()
    creatorById.set(row.id, name || row.email || "")
  }

  return payments.map((p) => {
    const reversal = reversalsByPaymentId.get(p.id) ?? null
    return {
      ...p,
      amount: Number(p.amount),
      reversed_at: reversal?.completed_at ?? null,
      reversal_transaction_id: reversal?.id ?? null,
      reversal_reason: reversal?.metadata?.reversal_reason ?? null,
      created_by_name: creatorById.get(p.created_by) ?? null,
    }
  })
}
