"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  calculateInvoiceTotals,
  calculateItemAmounts,
  roundToTwoDecimals,
} from "@/lib/invoices/invoice-calculations"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { InvoiceCreateActionInput } from "@/lib/types/invoice-create"

const createInvoiceInputSchema = z.object({
  userId: z.string().uuid("Invalid member id"),
  issueDate: z.string().datetime({ offset: true }).optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  reference: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  items: z
    .array(
      z.object({
        chargeableId: z.string().uuid("Invalid chargeable id"),
        quantity: z.number().positive("Quantity must be greater than zero").max(9999),
        unitPrice: z.number().nonnegative("Unit price cannot be negative").max(999999999.99),
      })
    )
    .min(1, "At least one line item is required"),
})

type CreateInvoiceInput = z.infer<typeof createInvoiceInputSchema> & InvoiceCreateActionInput

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

function isRpcSuccess(v: unknown): v is { success: true } {
  if (typeof v !== "object" || v === null) return false
  if (!("success" in v)) return false
  return (v as Record<string, unknown>).success === true
}

async function createInvoiceInternal(input: unknown, shouldApprove: boolean) {
  const parsed = createInvoiceInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid invoice data" }
  }

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }
  if (!isStaff(role)) return { ok: false as const, error: "Only staff can create invoices" }

  const payload: CreateInvoiceInput = parsed.data

  const { data: memberMatch, error: memberError } = await supabase
    .from("tenant_users")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("user_id", payload.userId)
    .maybeSingle()

  if (memberError) {
    return { ok: false as const, error: "Failed to validate selected member" }
  }
  if (!memberMatch?.user_id) {
    return { ok: false as const, error: "Selected member is not in this tenant" }
  }

  const { data: taxRates, error: taxError } = await supabase
    .from("tax_rates")
    .select("rate, is_default, effective_from")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("effective_from", { ascending: false })

  if (taxError) {
    return { ok: false as const, error: "Failed to resolve tenant tax rate" }
  }

  const rawTaxRate = taxRates?.[0]?.rate
  const defaultTaxRate =
    typeof rawTaxRate === "number" && rawTaxRate >= 0 && rawTaxRate <= 1 ? rawTaxRate : 0
  const chargeableIds = Array.from(new Set(payload.items.map((item) => item.chargeableId)))

  const { data: chargeables, error: chargeablesError } = await supabase
    .from("chargeables")
    .select("id, name, is_taxable")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .is("voided_at", null)
    .in("id", chargeableIds)

  if (chargeablesError) {
    return { ok: false as const, error: "Failed to resolve invoice line items" }
  }

  const chargeableMap = new Map((chargeables ?? []).map((row) => [row.id, row]))

  for (const chargeableId of chargeableIds) {
    if (!chargeableMap.has(chargeableId)) {
      return { ok: false as const, error: "One or more line items are invalid for this tenant" }
    }
  }

  const normalizedItems = payload.items.map((item) => {
    const chargeable = chargeableMap.get(item.chargeableId)
    if (!chargeable) {
      throw new Error("Chargeable not found after validation")
    }

    const unitPrice = roundToTwoDecimals(item.unitPrice)
    const taxRate = chargeable.is_taxable ? defaultTaxRate : 0
    const amounts = calculateItemAmounts({
      quantity: item.quantity,
      unitPrice,
      taxRate,
    })

    return {
      chargeable_id: chargeable.id,
      description: chargeable.name,
      quantity: item.quantity,
      unit_price: unitPrice,
      tax_rate: taxRate,
      amount: amounts.amount,
      tax_amount: amounts.taxAmount,
      rate_inclusive: amounts.rateInclusive,
      line_total: amounts.lineTotal,
      notes: null as string | null,
      deleted_at: null as string | null,
    }
  })

  const totals = calculateInvoiceTotals(normalizedItems)
  const issueDate = payload.issueDate ?? new Date().toISOString()
  const { data: invoiceNumber, error: invoiceNumberError } = await supabase.rpc(
    "generate_invoice_number_app"
  )

  if (invoiceNumberError || !invoiceNumber) {
    return { ok: false as const, error: "Failed to generate invoice number" }
  }

  const { data: insertedInvoice, error: insertInvoiceError } = await supabase
    .from("invoices")
    .insert({
      tenant_id: tenantId,
      invoice_number: invoiceNumber,
      user_id: payload.userId,
      status: "draft",
      issue_date: issueDate,
      due_date: payload.dueDate ?? null,
      reference: payload.reference ?? null,
      notes: payload.notes ?? null,
      tax_rate: defaultTaxRate,
      subtotal: totals.subtotal,
      tax_total: totals.taxTotal,
      total_amount: totals.totalAmount,
      total_paid: 0,
      balance_due: totals.totalAmount,
    })
    .select("id")
    .single()

  if (insertInvoiceError || !insertedInvoice?.id) {
    return { ok: false as const, error: "Failed to create invoice" }
  }

  const invoiceId = insertedInvoice.id

  const { error: insertItemsError } = await supabase.from("invoice_items").insert(
    normalizedItems.map((item) => ({
      ...item,
      tenant_id: tenantId,
      invoice_id: invoiceId,
    }))
  )

  if (insertItemsError) {
    await supabase.rpc("soft_delete_invoice", {
      p_invoice_id: invoiceId,
      p_user_id: user.id,
      p_reason: "Rollback due to invoice item insert failure",
    })

    return { ok: false as const, error: "Failed to create invoice items" }
  }

  if (shouldApprove) {
    const { data: totalsResult, error: totalsUpdateError } = await supabase.rpc(
      "update_invoice_totals_atomic",
      {
        p_invoice_id: invoiceId,
      }
    )

    if (totalsUpdateError || !isRpcSuccess(totalsResult)) {
      return {
        ok: false as const,
        error: "Invoice created, but totals update failed before approval",
      }
    }

    const { data: statusResult, error: statusUpdateError } = await supabase.rpc(
      "update_invoice_status_atomic",
      {
        p_invoice_id: invoiceId,
        p_new_status: "pending",
      }
    )

    if (statusUpdateError || !isRpcSuccess(statusResult)) {
      return {
        ok: false as const,
        error: "Invoice created as draft, but approval failed",
      }
    }
  }

  revalidatePath("/invoices")
  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath("/invoices/new")

  return { ok: true as const, invoiceId }
}

export async function createInvoiceDraftAction(input: unknown) {
  return createInvoiceInternal(input, false)
}

export async function createAndApproveInvoiceAction(input: unknown) {
  return createInvoiceInternal(input, true)
}
