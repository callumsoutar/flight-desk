"use client"

import { useQuery } from "@tanstack/react-query"

import type { InvoiceWithRelations } from "@/lib/types/invoices"

type InvoicesQueryResponse = {
  invoices?: InvoiceWithRelations[]
  error?: string
}

type UseInvoicesQueryOptions = {
  includeXero: boolean
  initialData: InvoiceWithRelations[]
}

export function invoicesQueryKey(includeXero: boolean) {
  return ["invoices", "list", includeXero ? "xero" : "base"] as const
}

export async function fetchInvoicesQuery(includeXero: boolean): Promise<InvoiceWithRelations[]> {
  const search = new URLSearchParams()
  if (includeXero) search.set("include_xero", "true")

  const response = await fetch(`/api/invoices?${search.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })

  const payload = (await response.json().catch(() => null)) as InvoicesQueryResponse | null
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load invoices")
  }

  return Array.isArray(payload?.invoices) ? payload.invoices : []
}

export function useInvoicesQuery({ includeXero, initialData }: UseInvoicesQueryOptions) {
  return useQuery({
    queryKey: invoicesQueryKey(includeXero),
    queryFn: () => fetchInvoicesQuery(includeXero),
    initialData,
    staleTime: 30_000,
  })
}
