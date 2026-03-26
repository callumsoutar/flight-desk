"use client"

import { useQuery } from "@tanstack/react-query"

export type XeroAccountOption = {
  xero_account_id: string
  code: string | null
  name: string
  type: string | null
  status: string | null
}

type LocalXeroAccount = {
  id: string
  code: string | null
  name: string
  status: string | null
}

function toTypeParam(accountTypes?: string[]) {
  return accountTypes?.length ? `?type=${accountTypes.join(",")}` : ""
}

export function xeroChartOfAccountsQueryKey(accountTypes?: string[]) {
  return ["xero", "chart-of-accounts", toTypeParam(accountTypes)] as const
}

export function xeroActiveAccountsQueryKey() {
  return ["xero", "accounts", "active"] as const
}

export async function fetchXeroChartOfAccounts(accountTypes?: string[]) {
  const typeParam = toTypeParam(accountTypes)
  const response = await fetch(`/api/xero/chart-of-accounts${typeParam}`, {
    cache: "no-store",
  })
  if (!response.ok) return [] as XeroAccountOption[]
  const body = (await response.json().catch(() => null)) as { accounts?: XeroAccountOption[] } | null
  return body?.accounts ?? []
}

export async function fetchXeroActiveAccounts() {
  const response = await fetch("/api/xero/accounts", { cache: "no-store" })
  if (!response.ok) return [] as LocalXeroAccount[]
  const body = (await response.json().catch(() => null)) as { accounts?: LocalXeroAccount[] } | null
  return (body?.accounts ?? []).filter((account) => account.status === "ACTIVE")
}

export async function cacheSelectedXeroAccount(account: XeroAccountOption) {
  await fetch("/api/xero/accounts/upsert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      xero_account_id: account.xero_account_id,
      code: account.code,
      name: account.name,
      type: account.type,
      status: account.status,
    }),
  })
}

export function useXeroChartOfAccountsQuery(accountTypes: string[] | undefined, enabled: boolean) {
  return useQuery({
    queryKey: xeroChartOfAccountsQueryKey(accountTypes),
    queryFn: () => fetchXeroChartOfAccounts(accountTypes),
    staleTime: 60_000,
    enabled,
  })
}

export function useXeroActiveAccountsQuery() {
  return useQuery({
    queryKey: xeroActiveAccountsQueryKey(),
    queryFn: fetchXeroActiveAccounts,
    staleTime: 60_000,
  })
}
