"use client"

import { useQuery } from "@tanstack/react-query"

export type MemberContactDetailsDto = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  street_address: string | null
}

export function memberContactDetailsQueryKey(memberId: string) {
  return ["member-contact-details", memberId] as const
}

function getMemberContactError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

export async function fetchMemberContactDetails(
  memberId: string,
  signal?: AbortSignal
): Promise<MemberContactDetailsDto> {
  const response = await fetch(`/api/members/${memberId}/contact-details`, {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
    signal,
  })
  const payload = (await response.json().catch(() => ({}))) as MemberContactDetailsDto & { error?: string }

  if (!response.ok) {
    throw new Error(getMemberContactError(payload, "Failed to load contact details"))
  }

  return payload
}

export function useMemberContactDetailsQuery(memberId: string, enabled = true) {
  return useQuery({
    queryKey: memberContactDetailsQueryKey(memberId),
    queryFn: ({ signal }) => fetchMemberContactDetails(memberId, signal),
    enabled: enabled && Boolean(memberId),
    staleTime: 30_000,
  })
}
