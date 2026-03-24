"use client"

import * as React from "react"

import { InvoicesTable } from "@/components/invoices/invoices-table"
import type { UserResult } from "@/components/invoices/member-select"
import type {
  InvoiceStatus,
  InvoiceWithRelations,
  InvoicesFilter,
} from "@/lib/types/invoices"

type Props = {
  invoices: InvoiceWithRelations[]
  members: UserResult[]
  xeroEnabled?: boolean
}

const EXPORTABLE_STATUSES: InvoiceStatus[] = ["authorised", "paid", "overdue"]

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

export function InvoicesPageClient({ invoices, members, xeroEnabled = false }: Props) {
  const [activeTab, setActiveTab] = React.useState("all")
  const [filters, setFilters] = React.useState<InvoicesFilter>({})

  React.useEffect(() => {
    if (!xeroEnabled && activeTab.startsWith("xero_")) {
      setActiveTab("all")
    }
  }, [activeTab, xeroEnabled])

  const isReadyForXero = React.useCallback(
    (invoice: InvoiceWithRelations) => {
      if (!EXPORTABLE_STATUSES.includes(invoice.status)) return false
      const status = invoice.xero_export_status
      return !status || status === "failed" || status === "voided"
    },
    []
  )

  const baseForCounts = React.useMemo(
    () => invoices.filter((invoice) => matchesSearch(invoice, filters.search)),
    [filters.search, invoices]
  )

  const filteredInvoices = React.useMemo(() => {
    return baseForCounts.filter((invoice) => {
      if (activeTab === "all") return true
      if (activeTab === "xero_ready") return isReadyForXero(invoice)
      if (activeTab === "xero_exported") return invoice.xero_export_status === "exported"
      if (activeTab === "xero_failed") return invoice.xero_export_status === "failed"
      return invoice.status === activeTab
    })
  }, [activeTab, baseForCounts, isReadyForXero])

  const tabCounts = React.useMemo(
    () => ({
      all: baseForCounts.length,
      draft: baseForCounts.filter((inv) => inv.status === "draft").length,
      authorised: baseForCounts.filter((inv) => inv.status === "authorised").length,
      paid: baseForCounts.filter((inv) => inv.status === "paid").length,
      overdue: baseForCounts.filter((inv) => inv.status === "overdue").length,
      xero_ready: xeroEnabled ? baseForCounts.filter((inv) => isReadyForXero(inv)).length : 0,
      xero_exported: xeroEnabled ? baseForCounts.filter((inv) => inv.xero_export_status === "exported").length : 0,
      xero_failed: xeroEnabled ? baseForCounts.filter((inv) => inv.xero_export_status === "failed").length : 0,
    }),
    [baseForCounts, isReadyForXero, xeroEnabled]
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
      members={members}
      xeroEnabled={xeroEnabled}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabCounts={tabCounts}
      onFiltersChange={handleFiltersChange}
    />
  )
}
