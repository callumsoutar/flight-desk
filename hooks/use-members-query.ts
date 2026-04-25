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
}): Promise<{
  id: string
  invitationRequested: boolean
  invitationSent: boolean
  invitationError: string | null
}> {
  const response = await fetch("/api/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    member?: { id?: string }
    invitation_requested?: boolean
    invitation_sent?: boolean
    invitation_error?: string | null
  }

  const createdMemberId = payload.member?.id
  if (!response.ok || !createdMemberId) {
    throw new Error(getMembersError(payload, "Failed to create member"))
  }

  return {
    id: createdMemberId,
    invitationRequested: payload.invitation_requested === true,
    invitationSent: payload.invitation_sent === true,
    invitationError: typeof payload.invitation_error === "string" ? payload.invitation_error : null,
  }
}

export function useMembersQuery(initialData: MemberWithRelations[]) {
  return useQuery({
    queryKey: membersQueryKey(),
    queryFn: fetchMembersQuery,
    initialData,
    staleTime: 30_000,
  })
}
