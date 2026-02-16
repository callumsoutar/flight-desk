"use client"

import * as React from "react"

import { InvoicesTable } from "@/components/invoices/invoices-table"
import type {
  InvoiceStatus,
  InvoiceWithRelations,
  InvoicesFilter,
} from "@/lib/types/invoices"

type Props = {
  invoices: InvoiceWithRelations[]
}

function matchesSearch(invoice: InvoiceWithRelations, search: string | undefined) {
  const q = search?.trim().toLowerCase()
  if (!q) return true

  const fullName = `${invoice.user?.first_name ?? ""} ${invoice.user?.last_name ?? ""}`
    .trim()
    .toLowerCase()

  return (
    (invoice.invoice_number ?? "").toLowerCase().includes(q) ||
    (invoice.reference ?? "").toLowerCase().includes(q) ||
    fullName.includes(q) ||
    (invoice.user?.email ?? "").toLowerCase().includes(q)
  )
}

export function InvoicesPageClient({ invoices }: Props) {
  const [activeTab, setActiveTab] = React.useState("all")
  const [filters, setFilters] = React.useState<InvoicesFilter>({})

  const baseForCounts = React.useMemo(
    () => invoices.filter((invoice) => matchesSearch(invoice, filters.search)),
    [filters.search, invoices]
  )

  const filteredInvoices = React.useMemo(() => {
    return baseForCounts.filter((invoice) => {
      if (activeTab === "all") return true
      return invoice.status === activeTab
    })
  }, [activeTab, baseForCounts])

  const tabCounts = React.useMemo(
    () => ({
      all: baseForCounts.length,
      draft: baseForCounts.filter((inv) => inv.status === "draft").length,
      pending: baseForCounts.filter((inv) => inv.status === "pending").length,
      paid: baseForCounts.filter((inv) => inv.status === "paid").length,
      overdue: baseForCounts.filter((inv) => inv.status === "overdue").length,
    }),
    [baseForCounts]
  )

  const handleFiltersChange = React.useCallback(
    (tableFilters: { search?: string; status?: InvoiceStatus[] }) => {
      setFilters((prev) => ({
        ...prev,
        search: tableFilters.search,
      }))
    },
    []
  )

  return (
    <InvoicesTable
      invoices={filteredInvoices}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabCounts={tabCounts}
      onFiltersChange={handleFiltersChange}
    />
  )
}
