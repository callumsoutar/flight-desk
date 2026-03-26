"use client"

import { useQuery } from "@tanstack/react-query"

import type { MemberTrainingPeekResponse } from "@/lib/types/member-training-peek"

export function memberTrainingPeekQueryKey(memberId: string | null) {
  return ["member-training-peek", memberId ?? ""] as const
}

export async function fetchMemberTrainingPeek(memberId: string): Promise<MemberTrainingPeekResponse> {
  const res = await fetch(`/api/members/${memberId}/training/peek`, {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })
  const payload = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(payload?.error || "Failed to load training info")
  return payload as unknown as MemberTrainingPeekResponse
}

export function useMemberTrainingPeekQuery(memberId: string | null, enabled = true) {
  return useQuery({
    queryKey: memberTrainingPeekQueryKey(memberId),
    queryFn: () => fetchMemberTrainingPeek(memberId as string),
    enabled: enabled && Boolean(memberId),
    staleTime: 30_000,
    retry: 1,
  })
}
