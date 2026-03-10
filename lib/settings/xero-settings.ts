import type { Json } from "@/lib/types"

export type XeroSettings = {
  enabled: boolean
  connected_at: string | null
  default_revenue_account_code: string | null
  default_tax_type: string | null
  auto_export_on_approve: boolean
}

export const DEFAULT_XERO_SETTINGS: XeroSettings = {
  enabled: false,
  connected_at: null,
  default_revenue_account_code: null,
  default_tax_type: null,
  auto_export_on_approve: false,
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

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

export function resolveXeroSettings(settings: Json | null | undefined): XeroSettings {
  if (!isJsonObject(settings)) return DEFAULT_XERO_SETTINGS

  return {
    enabled: normalizeBoolean(settings.enabled, DEFAULT_XERO_SETTINGS.enabled),
    connected_at: normalizeNullableString(settings.connected_at),
    default_revenue_account_code: normalizeNullableString(settings.default_revenue_account_code),
    default_tax_type: normalizeNullableString(settings.default_tax_type),
    auto_export_on_approve: normalizeBoolean(
      settings.auto_export_on_approve,
      DEFAULT_XERO_SETTINGS.auto_export_on_approve
    ),
  }
}
