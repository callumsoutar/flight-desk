"use client"

import { useQuery } from "@tanstack/react-query"

import type { ExperienceType, ExperienceTypeFormData } from "@/lib/types/experience-types"

type ExperienceTypesQueryParams = {
  includeInactive?: boolean
}

type ExperienceTypesResponse = {
  experience_types?: ExperienceType[]
}

function buildExperienceTypesQuery(params: ExperienceTypesQueryParams) {
  const query = new URLSearchParams()
  if (params.includeInactive) query.set("include_inactive", "true")
  return query.toString()
}

export function experienceTypesQueryKey(params: ExperienceTypesQueryParams) {
  return ["experience-types", params.includeInactive ? "inactive" : "active"] as const
}

export async function fetchExperienceTypesQuery(
  params: ExperienceTypesQueryParams
): Promise<ExperienceType[]> {
  const response = await fetch(`/api/experience-types?${buildExperienceTypesQuery(params)}`, {
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error("Failed to fetch experience types")
  }

  const data = (await response.json().catch(() => null)) as ExperienceTypesResponse | null
  return Array.isArray(data?.experience_types) ? data.experience_types : []
}

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function createExperienceType(input: ExperienceTypeFormData) {
  const response = await fetch("/api/experience-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to create experience type"))
  }
}

export async function updateExperienceType(input: ExperienceTypeFormData & { id: string }) {
  const response = await fetch("/api/experience-types", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update experience type"))
  }
}

export async function deactivateExperienceType(id: string) {
  const response = await fetch(`/api/experience-types?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to deactivate experience type"))
  }
}

export function useExperienceTypesQuery(params: ExperienceTypesQueryParams) {
  return useQuery({
    queryKey: experienceTypesQueryKey(params),
    queryFn: () => fetchExperienceTypesQuery(params),
    staleTime: 60 * 1000,
  })
}
