import type { Json } from "@/lib/types"
import { isJsonObject, normalizeNullableString } from "@/lib/settings/utils"

export type InvoicingSettings = {
  invoice_prefix: string
  invoice_number_mode: "internal" | "xero"
  default_invoice_due_days: number
  invoice_footer_message: string
  include_logo_on_invoice: boolean
  landing_fee_gl_code: string
  airways_fee_gl_code: string
}

export const DEFAULT_INVOICING_SETTINGS: InvoicingSettings = {
  invoice_prefix: "INV",
  invoice_number_mode: "internal",
  default_invoice_due_days: 7,
  invoice_footer_message: "Thank you for your business.",
  include_logo_on_invoice: true,
  landing_fee_gl_code: "",
  airways_fee_gl_code: "",
}

function normalizeNonNegativeInteger(value: unknown, fallback: number): number {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN
  if (!Number.isFinite(raw)) return fallback
  const rounded = Math.round(raw)
  if (rounded < 0) return fallback
  return rounded
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function normalizeInvoiceNumberMode(value: unknown): InvoicingSettings["invoice_number_mode"] {
  return value === "xero" ? "xero" : "internal"
}

export function resolveInvoicingSettings(settings: Json | null | undefined): InvoicingSettings {
  if (!isJsonObject(settings)) return DEFAULT_INVOICING_SETTINGS

  return {
    invoice_prefix:
      normalizeNullableString(settings.invoice_prefix) ?? DEFAULT_INVOICING_SETTINGS.invoice_prefix,
    invoice_number_mode: normalizeInvoiceNumberMode(settings.invoice_number_mode),
    default_invoice_due_days: normalizeNonNegativeInteger(
      settings.default_invoice_due_days,
      DEFAULT_INVOICING_SETTINGS.default_invoice_due_days
    ),
    invoice_footer_message:
      normalizeNullableString(settings.invoice_footer_message) ??
      DEFAULT_INVOICING_SETTINGS.invoice_footer_message,
    include_logo_on_invoice: normalizeBoolean(
      settings.include_logo_on_invoice,
      DEFAULT_INVOICING_SETTINGS.include_logo_on_invoice
    ),
    landing_fee_gl_code:
      normalizeNullableString(settings.landing_fee_gl_code) ??
      DEFAULT_INVOICING_SETTINGS.landing_fee_gl_code,
    airways_fee_gl_code:
      normalizeNullableString(settings.airways_fee_gl_code) ??
      DEFAULT_INVOICING_SETTINGS.airways_fee_gl_code,
  }
}

