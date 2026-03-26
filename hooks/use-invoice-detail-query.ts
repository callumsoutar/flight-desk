"use client"

import { useQuery } from "@tanstack/react-query"

import type { InvoiceItemsRow } from "@/lib/types"
import type { InvoiceWithRelations } from "@/lib/types/invoices"

type XeroStatusData = {
  export_status: "pending" | "exported" | "failed" | "voided"
  xero_invoice_id: string | null
  exported_at: string | null
  error_message: string | null
}

type InvoiceDetailQueryData = {
  invoice: InvoiceWithRelations
  items: InvoiceItemsRow[]
  xeroStatus: XeroStatusData | null
}

type InvoiceDetailResponse = {
  invoice?: InvoiceWithRelations
  xero_status?: XeroStatusData | null
  error?: string
}

type InvoiceItemsResponse = {
  invoice_items?: InvoiceItemsRow[]
  error?: string
}

type XeroExportResult = {
  invoiceId: string
  status: "exported" | "failed" | "skipped"
  error?: string
  reason?: string
  xeroInvoiceId?: string | null
}

type XeroExportResponse = {
  results?: XeroExportResult[]
  error?: string
}

type SendInvoiceEmailResponse = {
  error?: string
}

type VoidXeroInvoiceResponse = {
  success?: boolean
  error?: string
}

function getInvoiceApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export function invoiceDetailQueryKey(invoiceId: string) {
  return ["invoices", "detail", invoiceId] as const
}

export async function fetchInvoiceDetailQuery(invoiceId: string): Promise<InvoiceDetailQueryData> {
  const [invoiceResponse, itemsResponse] = await Promise.all([
    fetch(`/api/invoices/${invoiceId}`, {
      method: "GET",
      cache: "no-store",
      headers: { "cache-control": "no-store" },
    }),
    fetch(`/api/invoice_items?invoice_id=${invoiceId}`, {
      method: "GET",
      cache: "no-store",
      headers: { "cache-control": "no-store" },
    }),
  ])

  const invoicePayload = (await invoiceResponse.json().catch(() => null)) as InvoiceDetailResponse | null
  if (!invoiceResponse.ok || !invoicePayload?.invoice) {
    throw new Error(invoicePayload?.error || "Failed to load invoice detail")
  }

  const itemsPayload = (await itemsResponse.json().catch(() => null)) as InvoiceItemsResponse | null
  if (!itemsResponse.ok) {
    throw new Error(itemsPayload?.error || "Failed to load invoice items")
  }

  return {
    invoice: invoicePayload.invoice,
    items: Array.isArray(itemsPayload?.invoice_items) ? itemsPayload.invoice_items : [],
    xeroStatus: invoicePayload.xero_status ?? null,
  }
}

export async function exportInvoicesToXeroMutation(invoiceIds: string[]) {
  const response = await fetch("/api/xero/export-invoices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoiceIds }),
  })
  const payload = (await response.json().catch(() => null)) as XeroExportResponse | null
  if (!response.ok) {
    throw new Error(getInvoiceApiError(payload, "Failed to export invoices"))
  }
  return Array.isArray(payload?.results) ? payload.results : []
}

export async function sendInvoiceEmailMutation(invoiceId: string) {
  const response = await fetch("/api/email/send-invoice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoice_id: invoiceId }),
  })
  const payload = (await response.json().catch(() => null)) as SendInvoiceEmailResponse | null
  if (!response.ok) {
    throw new Error(getInvoiceApiError(payload, "Failed to send invoice email"))
  }
}

export async function voidXeroInvoiceMutation(input: { invoiceId: string; reason: string }) {
  const response = await fetch("/api/xero/void-invoice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => null)) as VoidXeroInvoiceResponse | null
  if (!response.ok || payload?.success === false) {
    throw new Error(getInvoiceApiError(payload, "Failed to void invoice"))
  }
}

export function useInvoiceDetailQuery(initialData: InvoiceDetailQueryData) {
  return useQuery({
    queryKey: invoiceDetailQueryKey(initialData.invoice.id),
    queryFn: () => fetchInvoiceDetailQuery(initialData.invoice.id),
    initialData,
    staleTime: 30_000,
  })
}
