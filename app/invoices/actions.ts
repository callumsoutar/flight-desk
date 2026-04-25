"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { roundToTwoDecimals } from "@/lib/invoices/invoice-calculations"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const paymentMethodSchema = z.enum([
  "cash",
  "credit_card",
  "debit_card",
  "bank_transfer",
  "other",
])

const recordMemberCreditPaymentSchema = z.object({
  userId: z.string().uuid("Invalid member id"),
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

export async function recordMemberCreditPaymentAction(input: unknown) {
  const parsed = recordMemberCreditPaymentSchema.safeParse(input)
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
  if (!isStaff(role)) return { ok: false as const, error: "Only staff can record member payments" }

  const { userId, amount, paymentMethod, paymentReference, notes, paidAt } = parsed.data
  const normalizedAmount = roundToTwoDecimals(amount)

  const { data: tenantMember, error: memberError } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()

  if (memberError) {
    return { ok: false as const, error: "Failed to validate member access" }
  }

  if (!tenantMember) {
    return { ok: false as const, error: "Member not found" }
  }

  const { data: paymentResult, error: paymentError } = await supabase.rpc(
    "record_member_credit_payment_atomic",
    {
      p_user_id: userId,
      p_amount: normalizedAmount,
      p_payment_method: paymentMethod,
      p_payment_reference: paymentReference ?? undefined,
      p_notes: notes ?? undefined,
      p_paid_at: paidAt ?? undefined,
    }
  )

  if (paymentError) {
    return { ok: false as const, error: "Failed to record member payment" }
  }

  if (!isRpcSuccess(paymentResult)) {
    return {
      ok: false as const,
      error: getRpcErrorMessage(paymentResult) ?? "Failed to record member payment",
    }
  }

  const result = paymentResult as Record<string, unknown>
  const transactionId = typeof result.transaction_id === "string" ? result.transaction_id : null
  const newBalance = typeof result.new_balance === "number" ? result.new_balance : null

  revalidatePath("/invoices")
  revalidatePath(`/members/${userId}`)

  return {
    ok: true as const,
    result: {
      transactionId,
      newBalance,
    },
  }
}
