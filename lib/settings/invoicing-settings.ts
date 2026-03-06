import type { Json } from "@/lib/types"

export type InvoicingSettings = {
  invoice_prefix: string
  default_invoice_due_days: number
  payment_terms_days: number
  payment_terms_message: string
  invoice_footer_message: string
  auto_generate_invoices: boolean
  include_logo_on_invoice: boolean
  invoice_due_reminder_days: number
  late_fee_percentage: number
}

export const DEFAULT_INVOICING_SETTINGS: InvoicingSettings = {
  invoice_prefix: "INV",
  default_invoice_due_days: 7,
  payment_terms_days: 30,
  payment_terms_message: "Payment terms: Net 30 days.",
  invoice_footer_message: "Thank you for your business.",
  auto_generate_invoices: false,
  include_logo_on_invoice: true,
  invoice_due_reminder_days: 7,
  late_fee_percentage: 0,
}

type JsonObject = Record<string, Json>

function isJsonObject(value: Json | null | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
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

function normalizePercentage(value: unknown, fallback: number): number {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN
  if (!Number.isFinite(raw)) return fallback
  const clamped = Math.max(0, Math.min(100, raw))
  return Math.round(clamped * 10) / 10
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

export function resolveInvoicingSettings(settings: Json | null | undefined): InvoicingSettings {
  if (!isJsonObject(settings)) return DEFAULT_INVOICING_SETTINGS

  return {
    invoice_prefix:
      normalizeNullableString(settings.invoice_prefix) ?? DEFAULT_INVOICING_SETTINGS.invoice_prefix,
    default_invoice_due_days: normalizeNonNegativeInteger(
      settings.default_invoice_due_days,
      DEFAULT_INVOICING_SETTINGS.default_invoice_due_days
    ),
    payment_terms_days: normalizeNonNegativeInteger(
      settings.payment_terms_days,
      DEFAULT_INVOICING_SETTINGS.payment_terms_days
    ),
    payment_terms_message:
      normalizeNullableString(settings.payment_terms_message) ??
      DEFAULT_INVOICING_SETTINGS.payment_terms_message,
    invoice_footer_message:
      normalizeNullableString(settings.invoice_footer_message) ??
      DEFAULT_INVOICING_SETTINGS.invoice_footer_message,
    auto_generate_invoices: normalizeBoolean(
      settings.auto_generate_invoices,
      DEFAULT_INVOICING_SETTINGS.auto_generate_invoices
    ),
    include_logo_on_invoice: normalizeBoolean(
      settings.include_logo_on_invoice,
      DEFAULT_INVOICING_SETTINGS.include_logo_on_invoice
    ),
    invoice_due_reminder_days: normalizeNonNegativeInteger(
      settings.invoice_due_reminder_days,
      DEFAULT_INVOICING_SETTINGS.invoice_due_reminder_days
    ),
    late_fee_percentage: normalizePercentage(
      settings.late_fee_percentage,
      DEFAULT_INVOICING_SETTINGS.late_fee_percentage
    ),
  }
}

