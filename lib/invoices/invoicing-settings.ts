import type { Json } from "@/lib/types"

export type InvoicingSettings = {
  schoolName: string
  billingAddress: string
  gstNumber: string
  contactPhone: string
  contactEmail: string
  invoiceFooter: string
  paymentTerms: string
}

export const DEFAULT_INVOICING_SETTINGS: InvoicingSettings = {
  schoolName: "Flight School",
  billingAddress: "",
  gstNumber: "",
  contactPhone: "",
  contactEmail: "",
  invoiceFooter: "Thank you for your business.",
  paymentTerms: "Payment terms: Net 30 days.",
}

type JsonObject = Record<string, Json>

type ResolveInvoicingSettingsInput = {
  tenantName: string | null
  tenantBillingAddress: string | null
  tenantAddress: string | null
  tenantContactEmail: string | null
  tenantContactPhone: string | null
  tenantGstNumber: string | null
  tenantSettings: Json | null
  legacyTenantSettings: Json | null
}

function isJsonObject(value: Json | null | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function readStringSetting(containers: JsonObject[], keys: string[]): string | null {
  for (const container of containers) {
    for (const key of keys) {
      const value = container[key]
      if (typeof value !== "string") continue
      const normalized = normalizeNullableString(value)
      if (normalized) return normalized
    }
  }
  return null
}

function readNumberSetting(containers: JsonObject[], keys: string[]): number | null {
  for (const container of containers) {
    for (const key of keys) {
      const value = container[key]
      if (typeof value === "number" && Number.isFinite(value)) return value
      if (typeof value === "string") {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
      }
    }
  }
  return null
}

function addSettingsContainer(value: Json | null, target: JsonObject[]) {
  if (!isJsonObject(value)) return

  const invoicing = value.invoicing
  if (isJsonObject(invoicing)) {
    target.push(invoicing)
  }

  const invoice = value.invoice
  if (isJsonObject(invoice)) {
    target.push(invoice)
  }

  target.push(value)
}

export function resolveInvoicingSettings(input: ResolveInvoicingSettingsInput): InvoicingSettings {
  const containers: JsonObject[] = []
  addSettingsContainer(input.tenantSettings, containers)
  addSettingsContainer(input.legacyTenantSettings, containers)

  const schoolName =
    readStringSetting(containers, ["school_name", "schoolName", "business_name", "businessName"]) ??
    normalizeNullableString(input.tenantName) ??
    DEFAULT_INVOICING_SETTINGS.schoolName

  const billingAddress =
    readStringSetting(containers, ["billing_address", "billingAddress", "address", "school_address"]) ??
    normalizeNullableString(input.tenantBillingAddress) ??
    normalizeNullableString(input.tenantAddress) ??
    ""

  const contactEmail =
    readStringSetting(containers, [
      "contact_email",
      "contactEmail",
      "email_from_address",
      "email_reply_to",
      "invoice_email",
    ]) ??
    normalizeNullableString(input.tenantContactEmail) ??
    ""

  const contactPhone =
    readStringSetting(containers, ["contact_phone", "contactPhone", "phone", "invoice_phone"]) ??
    normalizeNullableString(input.tenantContactPhone) ??
    ""

  const gstNumber =
    readStringSetting(containers, ["gst_number", "gstNumber", "tax_number", "taxNumber"]) ??
    normalizeNullableString(input.tenantGstNumber) ??
    ""

  const paymentTermsDays = readNumberSetting(containers, ["payment_terms_days", "paymentTermsDays"])
  const paymentTerms =
    readStringSetting(containers, [
      "payment_terms_message",
      "payment_terms",
      "paymentTerms",
      "invoice_payment_terms",
    ]) ??
    (paymentTermsDays !== null
      ? `Payment terms: Net ${Math.max(0, Math.round(paymentTermsDays))} days.`
      : DEFAULT_INVOICING_SETTINGS.paymentTerms)

  const invoiceFooter =
    readStringSetting(containers, ["invoice_footer_message", "invoice_footer", "invoiceFooter"]) ??
    DEFAULT_INVOICING_SETTINGS.invoiceFooter

  return {
    schoolName,
    billingAddress,
    gstNumber,
    contactPhone,
    contactEmail,
    invoiceFooter,
    paymentTerms,
  }
}
