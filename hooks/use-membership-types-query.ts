"use client"

import { useQuery } from "@tanstack/react-query"

import type { MembershipTypeWithChargeable } from "@/lib/types/memberships"

type MembershipTypesQueryParams = {
  includeInactive?: boolean
}

type MembershipTypesResponse = {
  membership_types?: MembershipTypeWithChargeable[]
}

function buildMembershipTypesQuery(params: MembershipTypesQueryParams) {
  const query = new URLSearchParams()
  if (params.includeInactive) query.set("include_inactive", "true")
  return query.toString()
}

export function membershipTypesQueryKey(params: MembershipTypesQueryParams) {
  return ["membership-types", params.includeInactive ? "inactive" : "active"] as const
}

export async function fetchMembershipTypesQuery(
  params: MembershipTypesQueryParams
): Promise<MembershipTypeWithChargeable[]> {
  const response = await fetch(`/api/membership-types?${buildMembershipTypesQuery(params)}`, {
    cache: "no-store",
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message =
      data && typeof data === "object" && typeof data.error === "string"
        ? data.error
        : "Failed to fetch membership types"
    throw new Error(message)
  }

  const data = (await response.json().catch(() => null)) as MembershipTypesResponse | null
  return Array.isArray(data?.membership_types) ? data.membership_types : []
}

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function createMembershipType(input: {
  name: string
  code: string
  description: string
  duration_months: number
  benefits: string[]
  is_active: boolean
  chargeable_id: string | null
}) {
  const response = await fetch("/api/membership-types", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to create membership type"))
  }
}

export async function updateMembershipType(
  id: string,
  input: {
    name: string
    code: string
    description: string
    duration_months: number
    benefits: string[]
    is_active: boolean
    chargeable_id: string | null
  }
) {
  const response = await fetch(`/api/membership-types/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update membership type"))
  }
}

export async function deactivateMembershipType(id: string) {
  const response = await fetch(`/api/membership-types/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to deactivate membership type"))
  }
}

export function useMembershipTypesQuery(params: MembershipTypesQueryParams) {
  return useQuery({
    queryKey: membershipTypesQueryKey(params),
    queryFn: () => fetchMembershipTypesQuery(params),
    staleTime: 60 * 1000,
  })
}
