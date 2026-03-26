"use client"

import { useQuery } from "@tanstack/react-query"

import type { InvoiceRow } from "@/lib/types"
import type { InvoiceItem } from "@/lib/types/invoice_items"

type BookingCheckinInvoiceData = {
  invoice: InvoiceRow
  invoiceItems: InvoiceItem[]
}

export function bookingCheckinInvoiceQueryKey(invoiceId: string | null) {
  return ["booking-checkin-invoice", invoiceId ?? ""] as const
}

async function fetchBookingCheckinInvoice(invoiceId: string): Promise<BookingCheckinInvoiceData> {
  const [invoiceResponse, itemsResponse] = await Promise.all([
    fetch(`/api/invoices/${invoiceId}`, { cache: "no-store" }),
    fetch(`/api/invoice_items?invoice_id=${invoiceId}`, { cache: "no-store" }),
  ])

  if (!invoiceResponse.ok || !itemsResponse.ok) {
    throw new Error("Failed to load invoice details")
  }

  const invoicePayload = (await invoiceResponse.json().catch(() => null)) as { invoice?: InvoiceRow } | null
  const itemsPayload = (await itemsResponse.json().catch(() => null)) as { invoice_items?: InvoiceItem[] } | null

  if (!invoicePayload?.invoice) {
    throw new Error("Failed to load invoice details")
  }

  return {
    invoice: invoicePayload.invoice,
    invoiceItems: Array.isArray(itemsPayload?.invoice_items) ? itemsPayload.invoice_items : [],
  }
}

export function useBookingCheckinInvoiceQuery(invoiceId: string | null) {
  return useQuery({
    queryKey: bookingCheckinInvoiceQueryKey(invoiceId),
    queryFn: () => fetchBookingCheckinInvoice(invoiceId as string),
    enabled: Boolean(invoiceId),
    staleTime: 60 * 1000,
    retry: false,
  })
}
