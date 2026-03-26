"use client"

import { useQuery } from "@tanstack/react-query"

import type { MemberFlightHistoryResponse } from "@/lib/types/flight-history"

export function memberFlightHistoryQueryKey(memberId: string) {
  return ["member-flight-history", memberId] as const
}

function getMemberFlightHistoryError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

export async function fetchMemberFlightHistory(memberId: string): Promise<MemberFlightHistoryResponse> {
  const response = await fetch(`/api/members/${memberId}/flight-history`, {
    method: "GET",
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => ({}))) as MemberFlightHistoryResponse & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(getMemberFlightHistoryError(payload, "Failed to load flight history"))
  }

  return payload
}

export function useMemberFlightHistoryQuery(memberId: string) {
  return useQuery({
    queryKey: memberFlightHistoryQueryKey(memberId),
    queryFn: () => fetchMemberFlightHistory(memberId),
    enabled: Boolean(memberId),
    staleTime: 30_000,
  })
}
