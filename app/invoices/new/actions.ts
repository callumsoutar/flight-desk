"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { fetchInvoicingSettings } from "@/lib/settings/fetch-invoicing-settings"
import { fetchXeroSettings } from "@/lib/settings/fetch-xero-settings"
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

function getRpcErrorMessage(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null
  if (!("error" in value)) return null
  const errorValue = (value as Record<string, unknown>).error
  return typeof errorValue === "string" && errorValue.trim().length > 0 ? errorValue : null
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
  const chargeableIds = Array.from(new Set(payload.items.map((item) => item.chargeableId)))

  const [memberResult, taxRatesResult, invoicingSettingsResult, xeroSettingsResult, chargeablesResult] =
    await Promise.all([
      supabase
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("user_id", payload.userId)
        .maybeSingle(),
      supabase
        .from("tax_rates")
        .select("rate, is_default, effective_from")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("effective_from", { ascending: false }),
      fetchInvoicingSettings(supabase, tenantId).catch(() => null),
      fetchXeroSettings(supabase, tenantId).catch(() => null),
      supabase
        .from("chargeables")
        .select("id, name, is_taxable, xero_tax_type, chargeable_type_id, gl_code")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .is("voided_at", null)
        .in("id", chargeableIds),
    ])

  if (memberResult.error) {
    return { ok: false as const, error: "Failed to validate selected member" }
  }
  if (!memberResult.data?.user_id) {
    return { ok: false as const, error: "Selected member is not in this tenant" }
  }

  if (taxRatesResult.error) {
    return { ok: false as const, error: "Failed to resolve tenant tax rate" }
  }

  if (chargeablesResult.error) {
    return { ok: false as const, error: "Failed to resolve invoice line items" }
  }

  const rawTaxRate = taxRatesResult.data?.[0]?.rate
  const defaultTaxRate =
    typeof rawTaxRate === "number" && rawTaxRate >= 0 && rawTaxRate <= 1 ? rawTaxRate : 0
  const invoicingSettings = invoicingSettingsResult
  const defaultXeroTaxType = xeroSettingsResult?.default_tax_type ?? null
  const chargeables = chargeablesResult.data

  const chargeableMap = new Map((chargeables ?? []).map((row) => [row.id, row]))

  const chargeableTypeIds = Array.from(
    new Set(
      (chargeables ?? [])
        .map((row) => row.chargeable_type_id)
        .filter((value): value is string => typeof value === "string")
    )
  )
  const { data: chargeableTypes, error: chargeableTypesError } = chargeableTypeIds.length
    ? await supabase
        .from("chargeable_types")
        .select("id, code, gl_code")
        .or(`tenant_id.eq.${tenantId},scope.eq.system`)
        .in("id", chargeableTypeIds)
    : { data: [], error: null }

  if (chargeableTypesError) {
    return { ok: false as const, error: "Failed to resolve chargeable type GL codes" }
  }
  const chargeableTypeById = new Map((chargeableTypes ?? []).map((type) => [type.id, type]))

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

    const unitPrice = item.unitPrice
    const taxRate = chargeable.is_taxable ? defaultTaxRate : 0
    return {
      chargeable_id: chargeable.id,
      description: chargeable.name,
      gl_code: (() => {
        const chargeableType = chargeableTypeById.get(chargeable.chargeable_type_id)
        if (chargeableType?.code === "landing_fees") {
          return invoicingSettings?.landing_fee_gl_code || null
        }
        if (chargeableType?.code === "airways_fees") {
          return invoicingSettings?.airways_fee_gl_code || null
        }
        return chargeable.gl_code ?? chargeableType?.gl_code ?? null
      })(),
      xero_tax_type: taxRate > 0 ? chargeable.xero_tax_type ?? defaultXeroTaxType : null,
      quantity: item.quantity,
      unit_price: unitPrice,
      tax_rate: taxRate,
      notes: null as string | null,
    }
  })

  const issueDate = payload.issueDate ?? new Date().toISOString()
  const rpcItems = normalizedItems.map((item) => ({
    chargeable_id: item.chargeable_id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    tax_rate: item.tax_rate,
    notes: item.notes,
  }))
  const createStatus = shouldApprove ? "authorised" : "draft"

  const { data: createResult, error: createError } = await supabase.rpc("create_invoice_atomic", {
    p_user_id: payload.userId,
    p_booking_id: undefined,
    p_status: createStatus,
    p_invoice_number: undefined,
    p_tax_rate: defaultTaxRate,
    p_issue_date: issueDate,
    p_due_date: payload.dueDate ?? undefined,
    p_reference: payload.reference ?? undefined,
    p_notes: payload.notes ?? undefined,
    p_items: rpcItems,
  })

  if (createError) {
    return { ok: false as const, error: "Failed to create invoice" }
  }
  if (!isRpcSuccess(createResult)) {
    return {
      ok: false as const,
      error: getRpcErrorMessage(createResult) ?? "Failed to create invoice",
    }
  }

  const result = createResult as Record<string, unknown>
  const invoiceId = typeof result.invoice_id === "string" ? result.invoice_id : null
  if (!invoiceId) {
    return { ok: false as const, error: "Failed to resolve created invoice id" }
  }

  const { data: createdInvoiceItems } = await supabase
    .from("invoice_items")
    .select("id, chargeable_id, tax_rate")
    .eq("tenant_id", tenantId)
    .eq("invoice_id", invoiceId)
    .is("deleted_at", null)

  const itemUpdates = (createdInvoiceItems ?? []).map((item) => {
    let glCode: string | null = null
    let xeroTaxType: string | null = (item.tax_rate ?? 0) > 0 ? defaultXeroTaxType : null
    if (item.chargeable_id) {
      const chargeable = chargeableMap.get(item.chargeable_id)
      xeroTaxType = (item.tax_rate ?? 0) > 0 ? chargeable?.xero_tax_type ?? defaultXeroTaxType : null
      if (chargeable?.chargeable_type_id) {
        const chargeableType = chargeableTypeById.get(chargeable.chargeable_type_id)
        if (chargeableType?.code === "landing_fees") {
          glCode = invoicingSettings?.landing_fee_gl_code || null
        } else if (chargeableType?.code === "airways_fees") {
          glCode = invoicingSettings?.airways_fee_gl_code || null
        } else {
          glCode = chargeable.gl_code ?? chargeableType?.gl_code ?? null
        }
      }
    }

    return { id: item.id, gl_code: glCode, xero_tax_type: xeroTaxType }
  })

  await Promise.all(
    itemUpdates
      .filter((item) => item.gl_code || item.xero_tax_type)
      .map((item) =>
        supabase
          .from("invoice_items")
          .update({
            gl_code: item.gl_code ?? null,
            xero_tax_type: item.xero_tax_type ?? null,
          })
          .eq("id", item.id)
          .eq("tenant_id", tenantId)
      )
  )

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
