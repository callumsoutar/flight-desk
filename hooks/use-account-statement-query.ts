"use client"

import { useQuery } from "@tanstack/react-query"

import type { AccountStatementResponse } from "@/lib/types/account-statement"

export function accountStatementQueryKey(memberId: string, startDate: string, endDate: string) {
  return ["account-statement", memberId, startDate, endDate] as const
}

function getAccountStatementError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

export async function fetchAccountStatement(
  memberId: string,
  startDate: string,
  endDate: string
): Promise<AccountStatementResponse> {
  const params = new URLSearchParams({ user_id: memberId, start_date: startDate, end_date: endDate })
  const response = await fetch(`/api/account-statement?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => ({}))) as AccountStatementResponse & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(getAccountStatementError(payload, "Failed to load account statement"))
  }

  return payload
}

export async function sendAccountStatementEmail(input: {
  memberId: string
  startDate: string
  endDate: string
}) {
  const response = await fetch("/api/email/send-statement", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      user_id: input.memberId,
      from_date: input.startDate,
      to_date: input.endDate,
    }),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }

  if (!response.ok) {
    throw new Error(getAccountStatementError(payload, "Failed to send statement email"))
  }
}

export function useAccountStatementQuery(memberId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: accountStatementQueryKey(memberId, startDate, endDate),
    queryFn: () => fetchAccountStatement(memberId, startDate, endDate),
    enabled: Boolean(memberId),
    staleTime: 10_000,
  })
}
