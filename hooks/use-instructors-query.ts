"use client"

import { useQuery } from "@tanstack/react-query"

import type { InstructorWithRelations } from "@/lib/types/instructors"

export function instructorsQueryKey() {
  return ["instructors", "active"] as const
}

function getInstructorsError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

export async function voidInstructor(userId: string): Promise<void> {
  const response = await fetch(`/api/instructors/${userId}/void`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })

  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) {
    throw new Error(getInstructorsError(payload, "Failed to remove instructor"))
  }
}

export async function fetchInstructorsQuery(): Promise<InstructorWithRelations[]> {
  const response = await fetch("/api/instructors", { method: "GET", cache: "no-store" })
  const payload = (await response.json().catch(() => ({}))) as {
    instructors?: InstructorWithRelations[]
    error?: string
  }
  if (!response.ok) {
    throw new Error(getInstructorsError(payload, "Failed to load instructors"))
  }

  return payload.instructors ?? []
}

export function useInstructorsQuery(enabled = true) {
  return useQuery({
    queryKey: instructorsQueryKey(),
    queryFn: fetchInstructorsQuery,
    enabled,
    staleTime: 60_000,
  })
}
