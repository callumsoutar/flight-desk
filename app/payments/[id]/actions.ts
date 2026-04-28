"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import type { Json } from "@/lib/types/database"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function isAdminOrOwner(role: string | null): boolean {
  return role === "owner" || role === "admin"
}

const updateInvoicePaymentNotesSchema = z.object({
  paymentId: z.string().uuid(),
  notes: z.string().max(2000).nullable().optional(),
  paymentReference: z.string().max(200).nullable().optional(),
})

const updateMemberCreditMetadataSchema = z.object({
  transactionId: z.string().uuid(),
  description: z.string().trim().min(1).max(500).optional(),
  referenceNumber: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const deleteMemberCreditTransactionSchema = z.object({
  transactionId: z.string().uuid(),
})

export async function updateInvoicePaymentMetadataAction(input: unknown) {
  const parsed = updateInvoicePaymentNotesSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid update data" }
  }

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    includeTenant: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }
  if (!isAdminOrOwner(role)) {
    return { ok: false as const, error: "Only admins or owners can edit payments" }
  }

  const { paymentId, notes, paymentReference } = parsed.data

  if (notes === undefined && paymentReference === undefined) {
    return { ok: false as const, error: "Nothing to update" }
  }

  const { data: payment, error: loadErr } = await supabase
    .from("invoice_payments")
    .select("id, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("id", paymentId)
    .maybeSingle()

  if (loadErr) return { ok: false as const, error: "Failed to load payment" }
  if (!payment) return { ok: false as const, error: "Payment not found" }

  const { data: reversal, error: revErr } = await supabase
    .from("transactions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "completed")
    .eq("metadata->>transaction_type", "payment_reversal")
    .eq("metadata->>original_payment_id", paymentId)
    .maybeSingle()

  if (revErr) return { ok: false as const, error: "Failed to validate payment status" }
  if (reversal) {
    return { ok: false as const, error: "Reversed payments cannot be edited" }
  }

  const { error: patchErr } = await supabase
    .from("invoice_payments")
    .update({
      ...(notes !== undefined ? { notes: notes ?? null } : {}),
      ...(paymentReference !== undefined ? { payment_reference: paymentReference ?? null } : {}),
    })
    .eq("tenant_id", tenantId)
    .eq("id", paymentId)

  if (patchErr) {
    return { ok: false as const, error: "Could not save changes" }
  }

  revalidatePath(`/payments/${paymentId}`)
  revalidatePath("/invoices")
  const { data: invoiceRef } = await supabase
    .from("invoice_payments")
    .select("invoice_id, user_id")
    .eq("id", paymentId)
    .maybeSingle()
  if (invoiceRef?.invoice_id) {
    revalidatePath(`/invoices/${invoiceRef.invoice_id}`)
  }
  if (invoiceRef?.user_id) {
    revalidatePath(`/members/${invoiceRef.user_id}`)
  }

  return { ok: true as const }
}

export async function updateMemberCreditTransactionAction(input: unknown) {
  const parsed = updateMemberCreditMetadataSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid update data" }
  }

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    includeTenant: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }
  if (!isAdminOrOwner(role)) {
    return { ok: false as const, error: "Only admins or owners can edit payments" }
  }

  const { transactionId, description, referenceNumber, notes } = parsed.data

  if (
    description === undefined &&
    referenceNumber === undefined &&
    notes === undefined
  ) {
    return { ok: false as const, error: "Nothing to update" }
  }

  const { data: txn, error: txnErr } = await supabase
    .from("transactions")
    .select("id, tenant_id, metadata, status, type")
    .eq("tenant_id", tenantId)
    .eq("id", transactionId)
    .maybeSingle()

  if (txnErr) return { ok: false as const, error: "Failed to load transaction" }
  if (
    !txn ||
    txn.type !== "credit" ||
    txn.status !== "completed" ||
    (txn.metadata as { transaction_type?: string } | null)?.transaction_type !== "member_credit_topup"
  ) {
    return { ok: false as const, error: "Transaction not found" }
  }

  const md =
    txn.metadata && typeof txn.metadata === "object" && !Array.isArray(txn.metadata)
      ? { ...(txn.metadata as Record<string, unknown>) }
      : {}

  if (notes !== undefined) {
    md.notes = notes && notes.trim() !== "" ? notes : null
  }
  if (referenceNumber !== undefined) {
    md.payment_reference =
      referenceNumber && referenceNumber.trim() !== "" ? referenceNumber.trim() : null
  }

  const { error: upErr } = await supabase
    .from("transactions")
    .update({
      ...(description !== undefined ? { description } : {}),
      ...(referenceNumber !== undefined
        ? {
            reference_number:
              referenceNumber && referenceNumber.trim() !== ""
                ? referenceNumber.trim()
                : null,
          }
        : {}),
      metadata: md as Json,
    })
    .eq("tenant_id", tenantId)
    .eq("id", transactionId)

  if (upErr) {
    return { ok: false as const, error: "Could not save changes" }
  }

  revalidatePath(`/payments/${transactionId}`)
  const { data: uidRow } = await supabase
    .from("transactions")
    .select("user_id")
    .eq("id", transactionId)
    .maybeSingle()
  if (uidRow?.user_id) {
    revalidatePath(`/members/${uidRow.user_id}`)
  }

  return { ok: true as const }
}

export async function deleteMemberCreditTransactionAction(input: unknown) {
  const parsed = deleteMemberCreditTransactionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid request" }
  }

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    includeTenant: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }
  if (!isAdminOrOwner(role)) {
    return { ok: false as const, error: "Only admins or owners can delete credit records" }
  }

  const { transactionId } = parsed.data

  const { data: txn, error: txnErr } = await supabase
    .from("transactions")
    .select("id, tenant_id, user_id, type, status, metadata")
    .eq("tenant_id", tenantId)
    .eq("id", transactionId)
    .maybeSingle()

  if (txnErr) return { ok: false as const, error: "Failed to load transaction" }
  if (
    !txn ||
    txn.type !== "credit" ||
    txn.status !== "completed" ||
    (txn.metadata as { transaction_type?: string } | null)?.transaction_type !== "member_credit_topup"
  ) {
    return { ok: false as const, error: "Transaction not found" }
  }

  const { error: delErr } = await supabase.from("transactions").delete().eq("tenant_id", tenantId).eq("id", transactionId)

  if (delErr) {
    return { ok: false as const, error: "Could not delete this record" }
  }

  revalidatePath("/invoices")
  if (txn.user_id) {
    revalidatePath(`/members/${txn.user_id}`)
  }

  const redirectPath = txn.user_id ? `/members/${txn.user_id}?tab=finances` : "/invoices"
  return { ok: true as const, redirectTo: redirectPath }
}
