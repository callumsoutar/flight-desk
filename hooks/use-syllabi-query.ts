"use client"

import { useQuery } from "@tanstack/react-query"

import type { Syllabus, SyllabusFormData } from "@/lib/types/syllabus"

type SyllabiQueryParams = {
  includeInactive?: boolean
}

type SyllabiResponse = {
  syllabi?: Syllabus[]
}

function buildSyllabiQuery(params: SyllabiQueryParams) {
  const query = new URLSearchParams()
  if (params.includeInactive) query.set("include_inactive", "true")
  return query.toString()
}

export function syllabiQueryKey(params: SyllabiQueryParams) {
  return ["syllabi", params.includeInactive ? "inactive" : "active"] as const
}

export async function fetchSyllabiQuery(params: SyllabiQueryParams): Promise<Syllabus[]> {
  const response = await fetch(`/api/syllabus?${buildSyllabiQuery(params)}`, {
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error("Failed to fetch syllabi")
  }

  const data = (await response.json().catch(() => null)) as SyllabiResponse | null
  return Array.isArray(data?.syllabi) ? data.syllabi : []
}

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function createSyllabus(input: SyllabusFormData) {
  const response = await fetch("/api/syllabus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to create syllabus"))
  }
}

export async function updateSyllabus(input: SyllabusFormData & { id: string }) {
  const response = await fetch("/api/syllabus", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update syllabus"))
  }
}

export async function deactivateSyllabus(id: string) {
  const response = await fetch(`/api/syllabus?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to delete syllabus"))
  }
}

export function useSyllabiQuery(params: SyllabiQueryParams) {
  return useQuery({
    queryKey: syllabiQueryKey(params),
    queryFn: () => fetchSyllabiQuery(params),
    staleTime: 60 * 1000,
  })
}
