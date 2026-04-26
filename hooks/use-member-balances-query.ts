"use client"

import { useQuery } from "@tanstack/react-query"

import type { MemberWithBalance } from "@/lib/types/member-balances"

type MemberBalancesResponse = {
  members?: MemberWithBalance[]
  timeZone?: string
  error?: string
}

export function memberBalancesQueryKey() {
  return ["members", "balances"] as const
}

export async function fetchMemberBalancesQuery(): Promise<{
  members: MemberWithBalance[]
  timeZone: string
}> {
  const response = await fetch("/api/member-balances", {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })
  const payload = (await response.json().catch(() => null)) as MemberBalancesResponse | null
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load member balances")
  }

  return {
    members: Array.isArray(payload?.members) ? payload.members : [],
    timeZone: typeof payload?.timeZone === "string" ? payload.timeZone : "Pacific/Auckland",
  }
}

type InitialPayload = { members: MemberWithBalance[]; timeZone: string }

export function useMemberBalancesQuery(initial: InitialPayload) {
  return useQuery({
    queryKey: memberBalancesQueryKey(),
    queryFn: fetchMemberBalancesQuery,
    initialData: initial,
    staleTime: 30_000,
  })
}
