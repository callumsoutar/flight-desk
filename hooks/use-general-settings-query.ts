"use client"

import type { GeneralSettings } from "@/lib/settings/general-settings"

type GeneralSettingsResponse = { settings: GeneralSettings }

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function updateGeneralSettings(input: {
  tenant: {
    name: string
    registration_number: string | null
    description: string | null
    website_url: string | null
    contact_email: string | null
    contact_phone: string | null
    address: string | null
    billing_address: string | null
    gst_number: string | null
    timezone: string | null
    currency: string | null
  }
  businessHours: {
    openTime: string
    closeTime: string
    is24Hours: boolean
    isClosed: boolean
  }
}) {
  const response = await fetch("/api/settings/general", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update settings"))
  }
  return (await response.json()) as GeneralSettingsResponse
}

export async function removeGeneralLogo() {
  const response = await fetch("/api/settings/logo", { method: "DELETE" })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to remove logo"))
  }
}

export async function uploadGeneralLogo(file: File) {
  const uploadFormData = new FormData()
  uploadFormData.append("file", file)
  const response = await fetch("/api/settings/logo", {
    method: "POST",
    body: uploadFormData,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to upload logo"))
  }
  const payload = (await response.json().catch(() => null)) as { url?: unknown } | null
  const url = payload && typeof payload.url === "string" ? payload.url : null
  if (!url) {
    throw new Error("Upload completed, but logo URL was not returned.")
  }
  return url
}
