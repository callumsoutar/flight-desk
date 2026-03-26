"use client"

import { useQuery } from "@tanstack/react-query"

import type { UserResult } from "@/components/invoices/member-select"

type InvoiceMemberOptionsResponse = {
  members?: UserResult[]
  error?: string
}

export function invoiceMemberOptionsQueryKey() {
  return ["invoices", "member-options"] as const
}

export async function fetchInvoiceMemberOptionsQuery(): Promise<UserResult[]> {
  const response = await fetch("/api/invoices/member-options", {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })
  const payload = (await response.json().catch(() => null)) as InvoiceMemberOptionsResponse | null
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load invoice members")
  }
  return Array.isArray(payload?.members) ? payload.members : []
}

export function useInvoiceMemberOptionsQuery(initialData: UserResult[]) {
  return useQuery({
    queryKey: invoiceMemberOptionsQueryKey(),
    queryFn: fetchInvoiceMemberOptionsQuery,
    initialData,
    staleTime: 30_000,
  })
}
