"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { roundToTwoDecimals } from "@/lib/invoices/invoice-calculations"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const approveDraftInvoiceSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice id"),
})

const paymentMethodSchema = z.enum([
  "cash",
  "credit_card",
  "debit_card",
  "bank_transfer",
  "check",
  "online_payment",
  "other",
])

const recordInvoicePaymentSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice id"),
  amount: z.number().positive("Amount must be greater than zero").max(999999999.99),
  paymentMethod: paymentMethodSchema,
  paymentReference: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  paidAt: z.string().datetime({ offset: true }).nullable().optional(),
})

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

function isRpcSuccess(value: unknown): value is { success: true } {
  if (typeof value !== "object" || value === null) return false
  if (!("success" in value)) return false
  return (value as Record<string, unknown>).success === true
}

function getRpcErrorMessage(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null
  if (!("error" in value)) return null
  const errorValue = (value as Record<string, unknown>).error
  return typeof errorValue === "string" && errorValue.trim().length > 0 ? errorValue : null
}

export async function approveDraftInvoiceAction(input: unknown) {
  const parsed = approveDraftInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid invoice id" }
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
  if (!isStaff(role)) return { ok: false as const, error: "Only staff can approve invoices" }

  const { invoiceId } = parsed.data

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (invoiceError) {
    return { ok: false as const, error: "Failed to load invoice" }
  }
  if (!invoice) {
    return { ok: false as const, error: "Invoice not found" }
  }
  if (invoice.status !== "draft") {
    return { ok: false as const, error: "Only draft invoices can be approved" }
  }

  const { data: totalsResult, error: totalsError } = await supabase.rpc("update_invoice_totals_atomic", {
    p_invoice_id: invoiceId,
  })

  if (totalsError || !isRpcSuccess(totalsResult)) {
    return { ok: false as const, error: "Failed to update totals before approval" }
  }

  const { data: statusResult, error: statusError } = await supabase.rpc("update_invoice_status_atomic", {
    p_invoice_id: invoiceId,
    p_new_status: "pending",
  })

  if (statusError || !isRpcSuccess(statusResult)) {
    return { ok: false as const, error: "Failed to approve invoice" }
  }

  revalidatePath("/invoices")
  revalidatePath(`/invoices/${invoiceId}`)

  return { ok: true as const }
}

export async function recordInvoicePaymentAction(input: unknown) {
  const parsed = recordInvoicePaymentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid payment data" }
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
  if (!isStaff(role)) return { ok: false as const, error: "Only staff can record payments" }

  const { invoiceId, amount, paymentMethod, paymentReference, notes, paidAt } = parsed.data
  const normalizedAmount = roundToTwoDecimals(amount)

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, status, balance_due, total_amount, total_paid")
    .eq("tenant_id", tenantId)
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (invoiceError) {
    return { ok: false as const, error: "Failed to load invoice" }
  }
  if (!invoice) {
    return { ok: false as const, error: "Invoice not found" }
  }
  if (invoice.status !== "pending" && invoice.status !== "overdue") {
    return { ok: false as const, error: "Payments can only be recorded for pending or overdue invoices" }
  }

  const computedBalance =
    typeof invoice.balance_due === "number"
      ? invoice.balance_due
      : (invoice.total_amount ?? 0) - (invoice.total_paid ?? 0)
  const remainingBalance = Math.max(0, roundToTwoDecimals(computedBalance))

  if (normalizedAmount > remainingBalance) {
    return {
      ok: false as const,
      error: `Payment amount cannot exceed remaining balance ($${remainingBalance.toFixed(2)})`,
    }
  }

  const { data: paymentResult, error: paymentError } = await supabase.rpc("record_invoice_payment_atomic", {
    p_invoice_id: invoiceId,
    p_amount: normalizedAmount,
    p_payment_method: paymentMethod,
    p_payment_reference: paymentReference ?? undefined,
    p_notes: notes ?? undefined,
    p_paid_at: paidAt ?? undefined,
  })

  if (paymentError) {
    return { ok: false as const, error: "Failed to record payment" }
  }
  if (!isRpcSuccess(paymentResult)) {
    return {
      ok: false as const,
      error: getRpcErrorMessage(paymentResult) ?? "Failed to record payment",
    }
  }

  const result = paymentResult as Record<string, unknown>
  const transactionId = typeof result.transaction_id === "string" ? result.transaction_id : null
  const paymentId = typeof result.payment_id === "string" ? result.payment_id : null

  revalidatePath("/invoices")
  revalidatePath(`/invoices/${invoiceId}`)

  return {
    ok: true as const,
    result: {
      transactionId,
      paymentId,
    },
  }
}
