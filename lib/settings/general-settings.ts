import type { Json } from "@/lib/types"
import { isJsonObject, type JsonObject } from "@/lib/settings/utils"

export type BusinessHoursSettings = {
  openTime: string
  closeTime: string
  is24Hours: boolean
  isClosed: boolean
}

export type GeneralTenantProfile = {
  name: string
  registration_number: string | null
  description: string | null
  website_url: string | null
  logo_url: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  billing_address: string | null
  gst_number: string | null
  timezone: string | null
  currency: string | null
}

export type GeneralSettings = {
  tenant: GeneralTenantProfile
  businessHours: BusinessHoursSettings
}

export const DEFAULT_BUSINESS_HOURS: BusinessHoursSettings = {
  openTime: "07:00",
  closeTime: "19:00",
  is24Hours: false,
  isClosed: false,
}

function normalizeTimeHHmm(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback
  const [hh, mm] = value.trim().split(":")
  const hour = Number(hh)
  const minute = Number(mm)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export function resolveBusinessHours(settings: Json | null | undefined): BusinessHoursSettings {
  if (!isJsonObject(settings)) return DEFAULT_BUSINESS_HOURS

  return {
    openTime: normalizeTimeHHmm(settings.business_open_time, DEFAULT_BUSINESS_HOURS.openTime),
    closeTime: normalizeTimeHHmm(settings.business_close_time, DEFAULT_BUSINESS_HOURS.closeTime),
    is24Hours:
      typeof settings.business_is_24_hours === "boolean"
        ? settings.business_is_24_hours
        : DEFAULT_BUSINESS_HOURS.is24Hours,
    isClosed:
      typeof settings.business_is_closed === "boolean"
        ? settings.business_is_closed
        : DEFAULT_BUSINESS_HOURS.isClosed,
  }
}

export function businessHoursToTenantSettingsPatch(input: BusinessHoursSettings): JsonObject {
  return {
    business_open_time: input.openTime,
    business_close_time: input.closeTime,
    business_is_24_hours: input.is24Hours,
    business_is_closed: input.isClosed,
  }
}

