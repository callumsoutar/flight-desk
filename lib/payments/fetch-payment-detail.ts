import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import { isReceiptColumnMissingError, parseReceiptNumber } from "@/lib/supabase/is-receipt-column-missing-error"

type ReversalMetaRow = {
  id: string
  completed_at: string | null
  metadata: { original_payment_id?: string; reversal_reason?: string } | null
}

export type InvoicePaymentDetail = {
  kind: "invoice_payment"
  id: string
  invoice_id: string
  invoice_number: string | null
  receipt_number: number | null
  amount: number
  payment_method: Database["public"]["Enums"]["payment_method"]
  payment_reference: string | null
  notes: string | null
  paid_at: string
  transaction_id: string
  created_by: string
  created_at: string
  user_id: string
  payer_name: string | null
  reversed_at: string | null
  reversal_transaction_id: string | null
  reversal_reason: string | null
  created_by_name: string | null
}

type InvoicePaymentQueryRow = Omit<
  InvoicePaymentDetail,
  "kind" | "invoice_number" | "receipt_number" | "payer_name" | "reversed_at" | "reversal_transaction_id" | "reversal_reason" | "created_by_name"
> & {
  receipt_number?: number | null
  invoices: { invoice_number?: string | null; deleted_at?: string | null } | { invoice_number?: string | null; deleted_at?: string | null }[] | null
}

type MemberCreditMetadata = {
  transaction_type?: string
  payment_method?: string
  payment_reference?: string | null
  notes?: string | null
}

export type MemberCreditPaymentDetail = {
  kind: "member_credit_topup"
  id: string
  tenant_id: string
  receipt_number: number | null
  amount: number
  description: string
  reference_number: string | null
  paid_at: string
  completed_at: string | null
  created_at: string
  user_id: string
  payer_name: string | null
  payment_method_label: string | null
  payment_reference: string | null
  notes: string | null
  metadata: MemberCreditMetadata | null
}

type MemberCreditPaymentQueryRow = Omit<
  MemberCreditPaymentDetail,
  "kind" | "receipt_number" | "payer_name" | "payment_method_label" | "payment_reference" | "notes" | "paid_at" | "metadata"
> & {
  receipt_number?: number | null
  paid_at?: string
  metadata: MemberCreditMetadata | null
  status: string
  type: string
}

export type PaymentDetailResult = InvoicePaymentDetail | MemberCreditPaymentDetail

const INVOICE_PAYMENT_SELECT_WITH_RECEIPT =
  "id, invoice_id, tenant_id, user_id, amount, payment_method, payment_reference, notes, paid_at, transaction_id, created_by, created_at, receipt_number, invoices(invoice_number, deleted_at)"
const INVOICE_PAYMENT_SELECT_LEGACY =
  "id, invoice_id, tenant_id, user_id, amount, payment_method, payment_reference, notes, paid_at, transaction_id, created_by, created_at, invoices(invoice_number, deleted_at)"

const TRANSACTION_PAYMENT_SELECT_WITH_RECEIPT =
  "id, tenant_id, user_id, amount, description, reference_number, completed_at, created_at, metadata, status, type, receipt_number"
const TRANSACTION_PAYMENT_SELECT_LEGACY =
  "id, tenant_id, user_id, amount, description, reference_number, completed_at, created_at, metadata, status, type"

function formatMethod(method: string): string {
  return method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function fetchPaymentDetailById(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  paymentId: string,
): Promise<PaymentDetailResult | null> {
  const ipFirst = await supabase
    .from("invoice_payments")
    .select(INVOICE_PAYMENT_SELECT_WITH_RECEIPT)
    .eq("tenant_id", tenantId)
    .eq("id", paymentId)
    .maybeSingle()

  let invoicePayment = (ipFirst.data ?? null) as InvoicePaymentQueryRow | null
  let ipError = ipFirst.error

  if (ipError && isReceiptColumnMissingError(ipError)) {
    const retry = await supabase
      .from("invoice_payments")
      .select(INVOICE_PAYMENT_SELECT_LEGACY)
      .eq("tenant_id", tenantId)
      .eq("id", paymentId)
      .maybeSingle()
    invoicePayment = (retry.data ?? null) as InvoicePaymentQueryRow | null
    ipError = retry.error
  }

  if (ipError) throw ipError

  if (invoicePayment) {
    const rawInv = invoicePayment.invoices
    const inv = Array.isArray(rawInv)
      ? (rawInv[0] as { invoice_number?: string | null } | undefined)
      : (rawInv as { invoice_number?: string | null } | null)

    let invoiceNumber: string | null = null
    if (inv && typeof inv === "object" && "invoice_number" in inv) {
      invoiceNumber = typeof inv.invoice_number === "string" ? inv.invoice_number : null
    }

    const { data: reversalRows, error: revError } = await supabase
      .from("transactions")
      .select("id, completed_at, metadata")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .eq("metadata->>transaction_type", "payment_reversal")
      .eq("metadata->>original_payment_id", invoicePayment.id)
      .maybeSingle()

    if (revError) throw revError

    const reversalMeta = reversalRows as ReversalMetaRow | null

    const [creatorRes, payerRes] = await Promise.all([
      supabase
        .from("user_directory")
        .select("id, first_name, last_name, email")
        .eq("id", invoicePayment.created_by)
        .maybeSingle(),
      supabase
        .from("user_directory")
        .select("id, first_name, last_name, email")
        .eq("id", invoicePayment.user_id)
        .maybeSingle(),
    ])

    if (creatorRes.error) throw creatorRes.error
    if (payerRes.error) throw payerRes.error

    const createdRow = creatorRes.data
    let created_by_name: string | null = null
    if (createdRow?.id) {
      const nm = [createdRow.first_name, createdRow.last_name].filter(Boolean).join(" ").trim()
      created_by_name = nm || createdRow.email || null
    }

    let payer_name: string | null = null
    const payer = payerRes.data
    if (payer?.id) {
      const nm = [payer.first_name, payer.last_name].filter(Boolean).join(" ").trim()
      payer_name = nm || payer.email || null
    }

    return {
      kind: "invoice_payment",
      id: invoicePayment.id,
      invoice_id: invoicePayment.invoice_id,
      invoice_number: invoiceNumber,
      receipt_number: parseReceiptNumber(
        "receipt_number" in invoicePayment ? invoicePayment.receipt_number : undefined,
      ),
      amount: Number(invoicePayment.amount),
      payment_method: invoicePayment.payment_method,
      payment_reference: invoicePayment.payment_reference,
      notes: invoicePayment.notes,
      paid_at: invoicePayment.paid_at,
      transaction_id: invoicePayment.transaction_id,
      created_by: invoicePayment.created_by,
      created_at: invoicePayment.created_at,
      user_id: invoicePayment.user_id,
      payer_name,
      reversed_at: reversalMeta?.completed_at ?? null,
      reversal_transaction_id: reversalMeta?.id ?? null,
      reversal_reason: reversalMeta?.metadata?.reversal_reason ?? null,
      created_by_name,
    } satisfies InvoicePaymentDetail
  }

  const txnFirst = await supabase
    .from("transactions")
    .select(TRANSACTION_PAYMENT_SELECT_WITH_RECEIPT)
    .eq("tenant_id", tenantId)
    .eq("id", paymentId)
    .maybeSingle()

  let txn = (txnFirst.data ?? null) as MemberCreditPaymentQueryRow | null
  let txnError = txnFirst.error

  if (txnError && isReceiptColumnMissingError(txnError)) {
    const retry = await supabase
      .from("transactions")
      .select(TRANSACTION_PAYMENT_SELECT_LEGACY)
      .eq("tenant_id", tenantId)
      .eq("id", paymentId)
      .maybeSingle()
    txn = (retry.data ?? null) as MemberCreditPaymentQueryRow | null
    txnError = retry.error
  }

  if (txnError) throw txnError
  if (
    !txn ||
    txn.type !== "credit" ||
    txn.status !== "completed" ||
    (txn.metadata as MemberCreditMetadata | null)?.transaction_type !== "member_credit_topup"
  ) {
    return null
  }

  const md = txn.metadata as MemberCreditMetadata | null

  let payer_name: string | null = null
  const payerRes = await supabase
    .from("user_directory")
    .select("id, first_name, last_name, email")
    .eq("id", txn.user_id)
    .maybeSingle()
  if (payerRes.error) throw payerRes.error
  const payer = payerRes.data
  if (payer?.id) {
    const nm = [payer.first_name, payer.last_name].filter(Boolean).join(" ").trim()
    payer_name = nm || payer.email || null
  }

  const methodRaw =
    md && typeof md.payment_method === "string" ? md.payment_method : null

  const eventDate =
    txn.completed_at && txn.completed_at.trim() !== "" ? txn.completed_at : txn.created_at

  return {
    kind: "member_credit_topup",
    id: txn.id,
    tenant_id: txn.tenant_id,
    receipt_number: parseReceiptNumber(
      "receipt_number" in txn ? txn.receipt_number : undefined,
    ),
    amount: Math.abs(Number(txn.amount)),
    description: txn.description,
    reference_number: txn.reference_number,
    paid_at: eventDate,
    completed_at: txn.completed_at,
    created_at: txn.created_at,
    user_id: txn.user_id,
    payer_name,
    payment_method_label: methodRaw ? formatMethod(methodRaw) : null,
    payment_reference:
      typeof md?.payment_reference === "string"
        ? md.payment_reference.trim() !== ""
          ? md.payment_reference
          : null
        : txn.reference_number,
    notes: typeof md?.notes === "string" ? md.notes : null,
    metadata: md,
  } satisfies MemberCreditPaymentDetail
}
