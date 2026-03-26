"use client"

import { useQuery } from "@tanstack/react-query"

import type { Endorsement, EndorsementFormData } from "@/lib/types/endorsements"

type EndorsementsQueryParams = {
  includeInactive?: boolean
}

type EndorsementsResponse = {
  endorsements?: Endorsement[]
}

function buildEndorsementsQuery(params: EndorsementsQueryParams) {
  const query = new URLSearchParams()
  if (params.includeInactive) query.set("include_inactive", "true")
  return query.toString()
}

export function endorsementsQueryKey(params: EndorsementsQueryParams) {
  return ["endorsements", params.includeInactive ? "inactive" : "active"] as const
}

export async function fetchEndorsementsQuery(params: EndorsementsQueryParams): Promise<Endorsement[]> {
  const response = await fetch(`/api/endorsements?${buildEndorsementsQuery(params)}`, {
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error("Failed to fetch endorsements")
  }

  const data = (await response.json().catch(() => null)) as EndorsementsResponse | null
  return Array.isArray(data?.endorsements) ? data.endorsements : []
}

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function createEndorsement(input: EndorsementFormData) {
  const response = await fetch("/api/endorsements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to create endorsement"))
  }
}

export async function updateEndorsement(input: EndorsementFormData & { id: string }) {
  const response = await fetch("/api/endorsements", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update endorsement"))
  }
}

export async function deactivateEndorsement(id: string) {
  const response = await fetch(`/api/endorsements?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to deactivate endorsement"))
  }
}

export function useEndorsementsQuery(params: EndorsementsQueryParams) {
  return useQuery({
    queryKey: endorsementsQueryKey(params),
    queryFn: () => fetchEndorsementsQuery(params),
    staleTime: 60 * 1000,
  })
}
