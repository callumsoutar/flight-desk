"use client"

import { useQuery } from "@tanstack/react-query"

import type { MemberWithRelations } from "@/lib/types/members"

type MembersQueryResponse = {
  members?: MemberWithRelations[]
  error?: string
}

export function membersQueryKey() {
  return ["members", "list"] as const
}

function getMembersError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

export async function fetchMembersQuery(): Promise<MemberWithRelations[]> {
  const response = await fetch("/api/members", {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })
  const payload = (await response.json().catch(() => null)) as MembersQueryResponse | null
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load members")
  }

  return Array.isArray(payload?.members) ? payload.members : []
}

export async function createMember(input: {
  first_name?: string | null
  last_name?: string | null
  email: string
  phone?: string | null
  street_address?: string | null
  send_invitation?: boolean
}): Promise<{ id: string }> {
  const response = await fetch("/api/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    member?: { id?: string }
  }

  if (!response.ok || !payload.member?.id) {
    throw new Error(getMembersError(payload, "Failed to create member"))
  }

  return payload.member
}

export function useMembersQuery(initialData: MemberWithRelations[]) {
  return useQuery({
    queryKey: membersQueryKey(),
    queryFn: fetchMembersQuery,
    initialData,
    staleTime: 30_000,
  })
}
