"use client"

import { useQuery } from "@tanstack/react-query"

import type { MembershipsSettings } from "@/lib/settings/memberships-settings"

type MembershipsSettingsResponse = { settings: MembershipsSettings }

export function membershipsSettingsQueryKey() {
  return ["settings", "memberships"] as const
}

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function fetchMembershipsSettingsQuery(): Promise<MembershipsSettings> {
  const response = await fetch("/api/settings/memberships", {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to load membership settings"))
  }
  const payload = (await response.json().catch(() => null)) as MembershipsSettingsResponse | null
  if (!payload?.settings) {
    throw new Error("Failed to load membership settings")
  }
  return payload.settings
}

export async function updateMembershipsSettings(input: {
  memberships: {
    membership_year: {
      start_month: number
      start_day: number
      description: string
      early_join_grace_days?: number
    }
  }
}) {
  const response = await fetch("/api/settings/memberships", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update membership settings"))
  }
  const payload = (await response.json().catch(() => null)) as MembershipsSettingsResponse | null
  if (!payload?.settings) {
    throw new Error("Settings saved, but failed to reload membership settings")
  }
  return payload
}

export function useMembershipsSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: membershipsSettingsQueryKey(),
    queryFn: fetchMembershipsSettingsQuery,
    enabled,
    staleTime: 60 * 1000,
  })
}
