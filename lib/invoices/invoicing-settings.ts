import type { Json } from "@/lib/types"
import { isJsonObject, normalizeNullableString, type JsonObject } from "@/lib/settings/utils"

export type InvoicingSettings = {
  schoolName: string
  billingAddress: string
  gstNumber: string
  contactPhone: string
  contactEmail: string
  invoiceFooter: string
  paymentTerms: string
  logoUrl: string | null
  includeLogoOnInvoice: boolean
}

export const DEFAULT_INVOICING_SETTINGS: InvoicingSettings = {
  schoolName: "Flight School",
  billingAddress: "",
  gstNumber: "",
  contactPhone: "",
  contactEmail: "",
  invoiceFooter: "Thank you for your business.",
  paymentTerms: "Payment terms: Net 30 days.",
  logoUrl: null,
  includeLogoOnInvoice: false,
}

type ResolveInvoicingSettingsInput = {
  tenantName: string | null
  tenantBillingAddress: string | null
  tenantAddress: string | null
  tenantContactEmail: string | null
  tenantContactPhone: string | null
  tenantGstNumber: string | null
  tenantSettings: Json | null
  tenantLogoUrl: string | null
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

/**
 * Same preference order as the rest of invoice branding (nested `invoicing` / `invoice` then root).
 * If the key was never saved, default to true so PDF/email match Settings → Invoicing (“include logo” default on).
 */
export function resolveIncludeLogoOnInvoiceFlag(tenantSettings: Json | null): boolean {
  const containers: JsonObject[] = []
  addSettingsContainer(tenantSettings, containers)
  for (const container of containers) {
    const val = container["include_logo_on_invoice"]
    if (typeof val === "boolean") {
      return val
    }
  }
  return true
}

export function resolveInvoicingSettings(input: ResolveInvoicingSettingsInput): InvoicingSettings {
  const containers: JsonObject[] = []
  addSettingsContainer(input.tenantSettings, containers)

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

  const paymentTerms = DEFAULT_INVOICING_SETTINGS.paymentTerms

  const invoiceFooter =
    readStringSetting(containers, ["invoice_footer_message", "invoice_footer", "invoiceFooter"]) ??
    DEFAULT_INVOICING_SETTINGS.invoiceFooter

  const includeLogoOnInvoice = resolveIncludeLogoOnInvoiceFlag(input.tenantSettings)

  const logoUrl = includeLogoOnInvoice ? (input.tenantLogoUrl ?? null) : null

  return {
    schoolName,
    billingAddress,
    gstNumber,
    contactPhone,
    contactEmail,
    invoiceFooter,
    paymentTerms,
    logoUrl,
    includeLogoOnInvoice,
  }
}
