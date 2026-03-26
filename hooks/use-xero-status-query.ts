"use client"

import { useQuery } from "@tanstack/react-query"

export type XeroStatusQueryData = {
  connected: boolean
  xero_tenant_name: string | null
  connected_at: string | null
  enabled: boolean
}

export function xeroStatusQueryKey() {
  return ["xero", "status"] as const
}

async function fetchXeroStatus(): Promise<XeroStatusQueryData> {
  const response = await fetch("/api/xero/status", {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || "Failed to load Xero status")
  }

  return (await response.json()) as XeroStatusQueryData
}

export async function disconnectXero() {
  const response = await fetch("/api/xero/disconnect", { method: "POST" })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || "Failed to disconnect Xero")
  }
}

export function useXeroStatusQuery(initialData?: XeroStatusQueryData) {
  return useQuery({
    queryKey: xeroStatusQueryKey(),
    queryFn: fetchXeroStatus,
    initialData,
    staleTime: 30 * 1000,
  })
}
