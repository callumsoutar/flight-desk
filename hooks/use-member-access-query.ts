"use client"

import { useQuery } from "@tanstack/react-query"

export type MemberAccessResponse = {
  portal_status: "active" | "pending_invite" | "not_invited"
  invite_status: "none" | "pending" | "accepted"
  account_created: boolean
  roles: { id: string; name: string }[]
  current_role: { id: string; name: string } | null
  email: string | null
  invited_at: string | null
}

export function memberAccessQueryKey(memberId: string) {
  return ["member-access", memberId] as const
}

function getMemberAccessError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

export async function fetchMemberAccessQuery(memberId: string): Promise<MemberAccessResponse> {
  const response = await fetch(`/api/members/${memberId}/access`, {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof payload.error === "string"
        ? payload.error
        : "Failed to load access status"
    throw new Error(message)
  }

  return payload as MemberAccessResponse
}

export async function inviteMemberAccess(memberId: string): Promise<{ sent: boolean }> {
  const response = await fetch(`/api/members/${memberId}/access/invite`, {
    method: "POST",
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(getMemberAccessError(payload, "Failed to send invitation"))
  }

  return payload as { sent: boolean }
}

export async function resendMemberInvite(memberId: string): Promise<{ sent: boolean }> {
  const response = await fetch(`/api/members/${memberId}/access/resend-invite`, {
    method: "POST",
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(getMemberAccessError(payload, "Failed to resend invitation"))
  }

  return payload as { sent: boolean }
}

export async function cancelMemberInvite(memberId: string): Promise<{ cancelled: boolean }> {
  const response = await fetch(`/api/members/${memberId}/access/cancel-invite`, {
    method: "POST",
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(getMemberAccessError(payload, "Failed to cancel invitation"))
  }

  return payload as { cancelled: boolean }
}

export async function updateMemberRoleAccess(
  memberId: string,
  roleId: string
): Promise<{ updated: boolean }> {
  const response = await fetch(`/api/members/${memberId}/access`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role_id: roleId }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(getMemberAccessError(payload, "Failed to update role"))
  }

  return payload as { updated: boolean }
}

export function useMemberAccessQuery(memberId: string) {
  return useQuery({
    queryKey: memberAccessQueryKey(memberId),
    queryFn: () => fetchMemberAccessQuery(memberId),
    enabled: Boolean(memberId),
    staleTime: 30_000,
  })
}
