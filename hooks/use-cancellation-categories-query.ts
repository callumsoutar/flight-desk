"use client"

import { useQuery } from "@tanstack/react-query"

import type { CancellationCategory } from "@/lib/types/cancellations"

type CancellationCategoriesResponse = {
  categories?: CancellationCategory[]
}

export const cancellationCategoriesQueryKey = ["cancellation-categories"] as const

export async function fetchCancellationCategoriesQuery(): Promise<CancellationCategory[]> {
  const response = await fetch("/api/cancellation-categories", { cache: "no-store" })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message =
      data && typeof data === "object" && typeof data.error === "string"
        ? data.error
        : "Failed to load cancellation categories"
    throw new Error(message)
  }

  const data = (await response.json().catch(() => null)) as CancellationCategoriesResponse | null
  return Array.isArray(data?.categories) ? data.categories : []
}

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function createCancellationCategory(input: { name: string; description: string | null }) {
  const response = await fetch("/api/cancellation-categories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to create cancellation category"))
  }
}

export async function updateCancellationCategory(input: { id: string; name: string; description: string | null }) {
  const response = await fetch("/api/cancellation-categories", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update cancellation category"))
  }
}

export async function deleteCancellationCategory(id: string) {
  const response = await fetch(`/api/cancellation-categories?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to delete cancellation category"))
  }
}

export function useCancellationCategoriesQuery(enabled = true) {
  return useQuery({
    queryKey: cancellationCategoriesQueryKey,
    queryFn: fetchCancellationCategoriesQuery,
    enabled,
    staleTime: 60 * 1000,
  })
}
