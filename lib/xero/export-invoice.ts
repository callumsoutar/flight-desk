import { getXeroClient } from "@/lib/xero/get-xero-client"
import { syncXeroContact } from "@/lib/xero/sync-contact"
import { XeroApiError } from "@/lib/xero/types"
import type { XeroInvoiceLineItem } from "@/lib/xero/types"
import { fetchXeroSettings } from "@/lib/settings/fetch-xero-settings"
import { fetchInvoicingSettings } from "@/lib/settings/fetch-invoicing-settings"
import { roundToTwoDecimals } from "@/lib/invoices/invoice-calculations"
import { logError, logWarn } from "@/lib/security/logger"
import type { Json } from "@/lib/types"

const EXPORTABLE_INVOICE_STATUSES = ["authorised", "paid", "overdue"] as const

function isExportableInvoiceStatus(status: string) {
  return EXPORTABLE_INVOICE_STATUSES.includes(status as (typeof EXPORTABLE_INVOICE_STATUSES)[number])
}

function toXeroDateInTimeZone(value: string | null, timeZone: string) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value ?? ""
  const month = parts.find((part) => part.type === "month")?.value ?? ""
  const day = parts.find((part) => part.type === "day")?.value ?? ""

  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
}

function isLikelyStaleContactError(error: unknown) {
  if (!(error instanceof XeroApiError)) return false
  if (error.status !== 400 && error.status !== 404) return false
  const serialized = JSON.stringify(error.body ?? {}).toLowerCase()
  return serialized.includes("contact")
}

export async function exportInvoiceToXero(tenantId: string, invoiceId: string, initiatedBy: string) {
  const { admin, client } = await getXeroClient(tenantId)

  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select("id, user_id, issue_date, due_date, invoice_number, reference, status")
    .eq("tenant_id", tenantId)
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (invoiceError || !invoice) {
    return { invoiceId, status: "failed" as const, error: "Invoice not found" }
  }

  if (!isExportableInvoiceStatus(invoice.status)) {
    return { invoiceId, status: "failed" as const, error: "Invoice is not eligible for Xero export" }
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .maybeSingle()

  const exportTimeZone = tenant?.timezone?.trim() || "Pacific/Auckland"
  const xeroIssueDate = toXeroDateInTimeZone(invoice.issue_date, exportTimeZone)
  const xeroDueDate = toXeroDateInTimeZone(invoice.due_date, exportTimeZone)

  if (!xeroIssueDate) {
    return { invoiceId, status: "failed" as const, error: "Invoice issue date is invalid for Xero export" }
  }

  const { data: existingExport, error: existingExportError } = await admin
    .from("xero_invoices")
    .select("id, export_status")
    .eq("tenant_id", tenantId)
    .eq("invoice_id", invoiceId)
    .maybeSingle()

  if (existingExportError) {
    return { invoiceId, status: "failed" as const, error: "Failed to check existing Xero export state" }
  }

  if (existingExport?.export_status === "exported") {
    return { invoiceId, status: "skipped" as const, reason: "already_exported" }
  }
  if (existingExport?.export_status === "pending") {
    return { invoiceId, status: "skipped" as const, reason: "pending" }
  }
  let lockRow: { id: string } | null = null
  let lockError: { message: string } | null = null

  if (existingExport?.export_status === "failed" || existingExport?.export_status === "voided") {
    const { data: updatedRow, error: updateError } = await admin
      .from("xero_invoices")
      .update({
        export_status: "pending",
        xero_invoice_id: null,
        exported_at: null,
        error_message: null,
      })
      .eq("id", existingExport.id)
      .select("id")
      .single()

    lockRow = updatedRow
    lockError = updateError
  } else {
    const { data: insertedLockRow, error: insertedLockError } = await admin
      .from("xero_invoices")
      .insert({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        export_status: "pending",
      })
      .select("id")
      .single()
    lockRow = insertedLockRow
    lockError = insertedLockError
  }

  if (lockError || !lockRow) {
    return { invoiceId, status: "failed" as const, error: "Could not create export lock" }
  }

  try {
    const [xeroSettings, invoicingSettings, itemsResult] = await Promise.all([
      fetchXeroSettings(admin, tenantId),
      fetchInvoicingSettings(admin, tenantId),
      admin
        .from("invoice_items")
        .select("description, quantity, unit_price, amount, tax_rate, tax_amount, gl_code, xero_tax_type, rate_inclusive, line_total")
        .eq("tenant_id", tenantId)
        .eq("invoice_id", invoiceId)
        .is("deleted_at", null),
    ])

    const { data: items, error: itemsError } = itemsResult
    if (itemsError || !items?.length) {
      throw new Error("Invoice has no items to export")
    }

    const defaultGlCode = xeroSettings.default_revenue_account_code
    const defaultTaxType = xeroSettings.default_tax_type

    const resolvedItems = items.map((item) => ({
      ...item,
      gl_code: item.gl_code ?? defaultGlCode,
      xero_tax_type: item.xero_tax_type ?? defaultTaxType ?? null,
    }))

    const invalidItem = resolvedItems.find((item) => !item.gl_code)
    if (invalidItem) {
      throw new Error(
        "Invoice contains items without GL code. Set a GL code on the chargeable type or flight type, or configure a default revenue account in Settings → Integrations."
      )
    }

    const glCodes = Array.from(new Set(resolvedItems.map((item) => item.gl_code).filter(Boolean)))
    const { data: accounts, error: accountsError } = await admin
      .from("xero_accounts")
      .select("code")
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE")
      .in("code", glCodes as string[])

    if (accountsError) throw accountsError
    const validCodes = new Set((accounts ?? []).map((row) => row.code).filter(Boolean))

    for (const code of glCodes) {
      if (!validCodes.has(code)) {
        throw new Error(
          `GL code '${code}' is not recognised. Please re-select the account from the Xero dropdown in ` +
            "Settings → Charges or Settings → Integrations so that it is validated against Xero."
        )
      }
    }

    for (const item of resolvedItems) {
      const isTaxable = (item.tax_rate ?? 0) > 0
      if (!isTaxable) {
        item.xero_tax_type = "NONE"
      }
    }

    const hasMissingTaxType = resolvedItems.some(
      (item) => (item.tax_rate ?? 0) > 0 && !item.xero_tax_type
    )
    if (hasMissingTaxType) {
      throw new Error(
        "Invoice contains taxable items without a Xero tax type. Set a tax type on the chargeable or configure a default tax type in Settings -> Integrations before exporting."
      )
    }

    const buildPayload = (xeroContactId: string) => {
      const payload = {
        Type: "ACCREC" as const,
        Contact: { ContactID: xeroContactId },
        Date: xeroIssueDate,
        DueDate: xeroDueDate,
        Reference: invoice.reference ?? null,
        Status: "AUTHORISED" as const,
        LineAmountTypes: "Inclusive" as const,
        LineItems: resolvedItems.map((item) => {
          const taxRate = item.tax_rate ?? 0
          const unitAmountInclusive = item.rate_inclusive
            ?? roundToTwoDecimals(item.unit_price * (1 + taxRate))
          const lineAmountInclusive = item.line_total
            ?? roundToTwoDecimals(item.quantity * unitAmountInclusive)

          const lineItem: XeroInvoiceLineItem = {
            Description: item.description,
            Quantity: item.quantity,
            UnitAmount: unitAmountInclusive,
            AccountCode: item.gl_code!,
            LineAmount: lineAmountInclusive,
          }
          lineItem.TaxType = item.xero_tax_type ?? "NONE"
          return lineItem
        }),
      }

      if (invoicingSettings.invoice_number_mode !== "xero") {
        return { ...payload, InvoiceNumber: invoice.invoice_number ?? invoice.id }
      }

      return payload
    }

    const idempotencyKey = `tenant-${tenantId}-invoice-${invoiceId}`
    let xeroContactId = await syncXeroContact(admin, client, tenantId, invoice.user_id, initiatedBy)
    let payload = buildPayload(xeroContactId)
    let xeroResponse

    try {
      xeroResponse = await client.createDraftInvoice(payload, idempotencyKey)
    } catch (error) {
      if (!isLikelyStaleContactError(error)) throw error

      logWarn("[xero] Stale contact mapping detected, re-syncing contact", {
        tenantId,
        invoiceId,
        userId: invoice.user_id,
      })

      await admin
        .from("xero_contacts")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("user_id", invoice.user_id)

      xeroContactId = await syncXeroContact(admin, client, tenantId, invoice.user_id, initiatedBy)
      payload = buildPayload(xeroContactId)
      xeroResponse = await client.createDraftInvoice(payload, idempotencyKey)
    }

    const xeroInvoiceId = xeroResponse.Invoices?.[0]?.InvoiceID

    await admin.from("xero_export_logs").insert({
      tenant_id: tenantId,
      invoice_id: invoiceId,
      action: "export_invoice",
      status: "success",
      initiated_by: initiatedBy,
      request_payload: payload,
      response_payload: xeroResponse,
    })

    await admin
      .from("xero_invoices")
      .update({
        export_status: "exported",
        xero_invoice_id: xeroInvoiceId ?? null,
        exported_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", lockRow.id)

    return { invoiceId, status: "exported" as const, xeroInvoiceId: xeroInvoiceId ?? null }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown export error"
    const responsePayload = error instanceof XeroApiError ? ((error.body ?? null) as Json) : null

    logError("[xero] Export invoice failed", {
      tenantId,
      invoiceId,
      error: message,
    })

    await admin.from("xero_export_logs").insert({
      tenant_id: tenantId,
      invoice_id: invoiceId,
      action: "export_invoice",
      status: "error",
      initiated_by: initiatedBy,
      error_message: message,
      response_payload: responsePayload,
    })

    await admin
      .from("xero_invoices")
      .update({
        export_status: "failed",
        error_message: message,
      })
      .eq("id", lockRow.id)

    return { invoiceId, status: "failed" as const, error: message }
  }
}
