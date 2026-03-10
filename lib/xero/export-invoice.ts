import { getXeroClient } from "@/lib/xero/get-xero-client"
import { syncXeroContact } from "@/lib/xero/sync-contact"

const EXPORTABLE_INVOICE_STATUSES = ["pending", "paid", "overdue"] as const

function isExportableInvoiceStatus(status: string) {
  return EXPORTABLE_INVOICE_STATUSES.includes(status as (typeof EXPORTABLE_INVOICE_STATUSES)[number])
}

export async function exportInvoiceToXero(tenantId: string, invoiceId: string, initiatedBy: string) {
  const { admin, client } = await getXeroClient(tenantId)

  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select("id, user_id, issue_date, due_date, invoice_number, reference, status")
    .eq("tenant_id", tenantId)
    .eq("id", invoiceId)
    .maybeSingle()

  if (invoiceError || !invoice) {
    return { invoiceId, status: "failed" as const, error: "Invoice not found" }
  }

  if (!isExportableInvoiceStatus(invoice.status)) {
    return { invoiceId, status: "failed" as const, error: "Invoice is not eligible for Xero export" }
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
  if (existingExport?.export_status === "failed") {
    await admin.from("xero_invoices").delete().eq("id", existingExport.id)
  }

  const { data: lockRow, error: lockError } = await admin
    .from("xero_invoices")
    .insert({
      tenant_id: tenantId,
      invoice_id: invoiceId,
      export_status: "pending",
    })
    .select("id")
    .single()

  if (lockError || !lockRow) {
    return { invoiceId, status: "failed" as const, error: "Could not create export lock" }
  }

  try {
    const { data: items, error: itemsError } = await admin
      .from("invoice_items")
      .select("description, quantity, unit_price, amount, gl_code, xero_tax_type")
      .eq("tenant_id", tenantId)
      .eq("invoice_id", invoiceId)
      .is("deleted_at", null)

    if (itemsError || !items?.length) {
      throw new Error("Invoice has no items to export")
    }

    const invalidItem = items.find((item) => !item.gl_code)
    if (invalidItem) throw new Error("Invoice contains items without GL code")

    const glCodes = Array.from(new Set(items.map((item) => item.gl_code).filter(Boolean)))
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
        throw new Error(`GL code '${code}' is not a valid Xero account.`)
      }
    }

    const xeroContactId = await syncXeroContact(admin, client, tenantId, invoice.user_id, initiatedBy)
    const payload = {
      Type: "ACCREC" as const,
      Contact: { ContactID: xeroContactId },
      Date: invoice.issue_date.slice(0, 10),
      DueDate: invoice.due_date ? invoice.due_date.slice(0, 10) : null,
      InvoiceNumber: invoice.invoice_number ?? invoice.id,
      Reference: invoice.reference ?? null,
      Status: "DRAFT" as const,
      LineItems: items.map((item) => ({
        Description: item.description,
        Quantity: item.quantity,
        UnitAmount: item.unit_price,
        AccountCode: item.gl_code ?? "",
        TaxType: item.xero_tax_type ?? "NONE",
        LineAmount: item.amount,
      })),
    }

    const xeroResponse = await client.createDraftInvoice(payload, `invoice-${invoiceId}`)
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

    await admin.from("xero_export_logs").insert({
      tenant_id: tenantId,
      invoice_id: invoiceId,
      action: "export_invoice",
      status: "error",
      initiated_by: initiatedBy,
      error_message: message,
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
