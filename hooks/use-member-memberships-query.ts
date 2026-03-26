"use client"

import { useQuery } from "@tanstack/react-query"

import type {
  MembershipSummary,
  MembershipTypeWithChargeable,
  MembershipYearSettings,
  TenantDefaultTaxRate,
} from "@/lib/types/memberships"

export type MemberMembershipsQueryData = {
  summary: MembershipSummary
  membershipTypes: MembershipTypeWithChargeable[]
  defaultTaxRate: TenantDefaultTaxRate
  membershipYear: MembershipYearSettings | null
}

type MemberMembershipsResponse = {
  summary?: MembershipSummary
  membership_types?: MembershipTypeWithChargeable[]
  default_tax_rate?: TenantDefaultTaxRate
  membership_year?: MembershipYearSettings | null
  error?: string
}

export function memberMembershipsQueryKey(memberId: string) {
  return ["members", "memberships", memberId] as const
}

export async function fetchMemberMembershipsQuery(memberId: string): Promise<MemberMembershipsQueryData> {
  const response = await fetch(`/api/members/${memberId}/memberships/summary`, {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })
  const payload = (await response.json().catch(() => null)) as MemberMembershipsResponse | null
  if (!response.ok || !payload?.summary) {
    throw new Error(payload?.error || "Failed to load member memberships")
  }

  return {
    summary: payload.summary,
    membershipTypes: Array.isArray(payload.membership_types) ? payload.membership_types : [],
    defaultTaxRate: payload.default_tax_rate ?? null,
    membershipYear: payload.membership_year ?? null,
  }
}

export function useMemberMembershipsQuery(
  memberId: string,
  initialData: MemberMembershipsQueryData
) {
  return useQuery({
    queryKey: memberMembershipsQueryKey(memberId),
    queryFn: () => fetchMemberMembershipsQuery(memberId),
    initialData,
    staleTime: 30_000,
  })
}
