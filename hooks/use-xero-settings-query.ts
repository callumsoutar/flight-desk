"use client"

import { useQuery } from "@tanstack/react-query"

import type { XeroSettings } from "@/lib/settings/xero-settings"

type XeroSettingsResponse = {
  settings: XeroSettings
}

export function xeroSettingsQueryKey() {
  return ["settings", "xero"] as const
}

async function fetchXeroSettings(): Promise<XeroSettings> {
  const response = await fetch("/api/settings/xero", {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || "Failed to load Xero settings")
  }

  const payload = (await response.json()) as XeroSettingsResponse
  return payload.settings
}

export async function updateXeroSettings(input: { xero: XeroSettings }) {
  const response = await fetch("/api/settings/xero", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || "Failed to save Xero settings")
  }
}

export function useXeroSettingsQuery(initialData?: XeroSettings | null) {
  return useQuery({
    queryKey: xeroSettingsQueryKey(),
    queryFn: fetchXeroSettings,
    initialData: initialData ?? undefined,
    staleTime: 30 * 1000,
  })
}
