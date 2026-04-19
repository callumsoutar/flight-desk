"use client"

import { useQuery } from "@tanstack/react-query"

import type { UserResult } from "@/components/invoices/member-select"
import type { InstructorCategoryLite } from "@/lib/types/instructors"

export type AddInstructorOptionsPayload = {
  members: UserResult[]
  categories: InstructorCategoryLite[]
}

export function addInstructorOptionsQueryKey() {
  return ["instructors", "add-options"] as const
}

export async function fetchAddInstructorOptionsQuery(): Promise<AddInstructorOptionsPayload> {
  const response = await fetch("/api/instructors/add-options", {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })
  const payload = (await response.json().catch(() => null)) as AddInstructorOptionsPayload & { error?: string }
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load options")
  }
  return {
    members: Array.isArray(payload.members) ? payload.members : [],
    categories: Array.isArray(payload.categories) ? payload.categories : [],
  }
}

export function useAddInstructorOptionsQuery(open: boolean) {
  return useQuery({
    queryKey: addInstructorOptionsQueryKey(),
    queryFn: fetchAddInstructorOptionsQuery,
    enabled: open,
    staleTime: 60_000,
  })
}
