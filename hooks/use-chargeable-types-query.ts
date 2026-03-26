"use client"

import { useQuery } from "@tanstack/react-query"

import type { ChargeableTypesRow } from "@/lib/types/tables"

type ChargeableTypeLite = Pick<
  ChargeableTypesRow,
  "id" | "code" | "name" | "description" | "gl_code" | "is_active" | "scope" | "system_key"
>

export function chargeableTypesQueryKey(excludeCode?: string) {
  return ["chargeable-types", excludeCode ?? ""] as const
}

export async function fetchChargeableTypes(excludeCode?: string): Promise<ChargeableTypeLite[]> {
  const query = new URLSearchParams({ is_active: "true" })
  if (excludeCode) query.set("exclude_code", excludeCode)

  const response = await fetch(`/api/chargeable_types?${query.toString()}`, {
    cache: "no-store",
  })
  if (!response.ok) return []

  const data = (await response.json().catch(() => null)) as { chargeable_types?: unknown } | null
  return Array.isArray(data?.chargeable_types) ? (data.chargeable_types as ChargeableTypeLite[]) : []
}

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function createChargeableType(input: {
  code: string
  name: string
  description: string | null
  gl_code: string | null
  is_active: boolean
}) {
  const response = await fetch("/api/chargeable_types", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to create chargeable type"))
  }
}

export async function updateChargeableType(input: {
  id: string
  code: string
  name: string
  description: string | null
  gl_code: string | null
  is_active: boolean
}) {
  const response = await fetch("/api/chargeable_types", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update chargeable type"))
  }
}

export async function deleteChargeableType(id: string) {
  const response = await fetch(`/api/chargeable_types?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to delete chargeable type"))
  }
}

export function useChargeableTypesQuery(excludeCode?: string) {
  return useQuery({
    queryKey: chargeableTypesQueryKey(excludeCode),
    queryFn: () => fetchChargeableTypes(excludeCode),
    staleTime: 5 * 60 * 1000,
  })
}
