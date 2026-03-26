"use client"

import type { InvoicingSettings } from "@/lib/settings/invoicing-settings"

type InvoicingSettingsResponse = { settings: InvoicingSettings }

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function updateInvoicingSettings(input: {
  invoicing: {
    invoice_prefix: string
    invoice_number_mode: "internal" | "xero"
    default_invoice_due_days: number
    invoice_footer_message: string
    include_logo_on_invoice: boolean
    landing_fee_gl_code: string | null
    airways_fee_gl_code: string | null
  }
}) {
  const response = await fetch("/api/settings/invoicing", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update settings"))
  }
  return (await response.json()) as InvoicingSettingsResponse
}
