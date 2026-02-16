"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import {
  IconCalendar,
  IconChevronRight,
  IconCurrencyDollar,
  IconFileText,
  IconPlus,
  IconSearch,
  IconUser,
  IconX,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { InvoiceStatus, InvoiceWithRelations } from "@/lib/types/invoices"

interface InvoicesTableProps {
  invoices: InvoiceWithRelations[]
  activeTab: string
  onTabChange: (tab: string) => void
  tabCounts: {
    all: number
    draft: number
    pending: number
    paid: number
    overdue: number
  }
  onFiltersChange?: (filters: {
    search?: string
    status?: InvoiceStatus[]
  }) => void
}

function getStatusBadgeVariant(status: InvoiceStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "paid":
      return "default"
    case "pending":
      return "secondary"
    case "overdue":
      return "destructive"
    case "draft":
    case "cancelled":
    case "refunded":
      return "outline"
    default:
      return "outline"
  }
}

function getStatusLabel(status: InvoiceStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatMoney(value: number | null) {
  const amount = value ?? 0
  return `$${amount.toFixed(2)}`
}

function formatShortDate(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatYear(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { year: "numeric" })
}

const columns: ColumnDef<InvoiceWithRelations>[] = [
  {
    accessorKey: "invoice_number",
    header: () => (
      <div className="flex items-center gap-2">
        <IconFileText className="h-4 w-4 text-muted-foreground" />
        <span>Invoice #</span>
      </div>
    ),
    cell: ({ row }) => {
      const invoiceNumber = row.original.invoice_number
      return (
        <div className="font-mono font-medium">
          {invoiceNumber || `#${row.original.id.slice(0, 8)}`}
        </div>
      )
    },
  },
  {
    id: "user",
    accessorFn: (row) => {
      const user = row.user
      if (!user) return ""
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ")
      return name || user.email || ""
    },
    header: () => (
      <div className="flex items-center gap-2">
        <IconUser className="h-4 w-4 text-muted-foreground" />
        <span className="hidden md:inline">Bill To</span>
      </div>
    ),
    cell: ({ row }) => {
      const user = row.original.user
      if (!user) return <span className="text-muted-foreground">-</span>
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ")
      return <div className="font-medium">{name || user.email || "-"}</div>
    },
  },
  {
    accessorKey: "issue_date",
    header: () => (
      <div className="flex items-center gap-2">
        <IconCalendar className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">Issue Date</span>
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.issue_date
      return (
        <div>
          <div className="font-medium">{formatShortDate(value)}</div>
          <div className="hidden text-xs text-muted-foreground sm:block">{formatYear(value)}</div>
        </div>
      )
    },
  },
  {
    accessorKey: "due_date",
    header: () => (
      <div className="flex items-center gap-2">
        <IconCalendar className="h-4 w-4 text-muted-foreground" />
        <span className="hidden lg:inline">Due Date</span>
      </div>
    ),
    cell: ({ row }) => {
      const dueDate = row.original.due_date
      const isOverdue =
        row.original.status === "overdue" ||
        (row.original.status === "pending" && dueDate !== null && new Date(dueDate) < new Date())

      return (
        <div>
          <div className={cn("font-medium", isOverdue && "text-destructive")}>{formatShortDate(dueDate)}</div>
          <div className="hidden text-xs text-muted-foreground lg:block">{formatYear(dueDate)}</div>
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status
      return (
        <Badge variant={getStatusBadgeVariant(status)} className="font-medium">
          {getStatusLabel(status)}
        </Badge>
      )
    },
  },
  {
    accessorKey: "total_amount",
    header: () => (
      <div className="flex items-center gap-2">
        <IconCurrencyDollar className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">Total</span>
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right font-medium">{formatMoney(row.original.total_amount)}</div>
    ),
  },
]

export function InvoicesTable({
  invoices,
  activeTab,
  onTabChange,
  tabCounts,
  onFiltersChange,
}: InvoicesTableProps) {
  const router = useRouter()
  const [isNavigating, startNavigation] = React.useTransition()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const navigate = React.useCallback(
    (href: string) => {
      startNavigation(() => {
        router.push(href)
      })
    },
    [router]
  )

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(globalFilter)
    }, 300)

    return () => clearTimeout(timer)
  }, [globalFilter])

  React.useEffect(() => {
    onFiltersChange?.({ search: debouncedSearch || undefined })
  }, [debouncedSearch, onFiltersChange])

  const table = useReactTable({
    data: invoices,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  const tabs = [
    { id: "all", label: "All" },
    { id: "draft", label: "Draft" },
    { id: "pending", label: "Pending" },
    { id: "paid", label: "Paid" },
    { id: "overdue", label: "Overdue" },
  ] as const

  const rowCount = table.getRowModel().rows.length
  const page = table.getState().pagination
  const start = rowCount === 0 ? 0 : page.pageIndex * page.pageSize + 1
  const end = Math.min((page.pageIndex + 1) * page.pageSize, invoices.length)

  return (
    <div className={cn("flex flex-col gap-6", isNavigating && "cursor-progress")} aria-busy={isNavigating}>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Invoices</h1>
          <p className="mt-1 text-slate-600">View and manage all invoices</p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <div className="relative w-full sm:w-auto">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search invoices..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-10 w-full border-slate-200 bg-white pl-9 focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900 sm:w-64"
            />
            {globalFilter ? (
              <button
                type="button"
                onClick={() => setGlobalFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <IconX className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <Button
            className="h-10 w-full bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800 sm:w-auto"
            onClick={() => navigate("/invoices/new")}
          >
            <IconPlus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const count = tabCounts[tab.id]

          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all",
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  isActive ? "bg-slate-100 text-slate-900" : "bg-slate-50 text-slate-400"
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <React.Fragment key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </React.Fragment>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="group cursor-pointer transition-colors hover:bg-slate-50/50"
                  onClick={() => navigate(`/invoices/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  <td className="px-4 py-3.5 pr-6 text-right align-middle">
                    <IconChevronRight className="inline h-4 w-4 text-slate-300" />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 1} className="h-24 text-center font-medium text-slate-500">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const invoice = row.original
            const user = invoice.user
            const name = user
              ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Unknown"
              : "Unknown"

            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
                onClick={() => navigate(`/invoices/${invoice.id}`)}
              >
                <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-lg bg-slate-900" />

                <div className="mb-3 flex items-start justify-between pl-2">
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-slate-900">
                      {invoice.invoice_number || `#${invoice.id.slice(0, 8)}`}
                    </h3>
                    <span className="text-xs text-slate-600">{name}</span>
                  </div>
                  <Badge variant={getStatusBadgeVariant(invoice.status)} className="font-medium">
                    {getStatusLabel(invoice.status)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</div>
                    <div className="text-sm font-semibold text-slate-700">{formatShortDate(invoice.issue_date)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</div>
                    <div className="text-right text-sm font-bold text-slate-900">{formatMoney(invoice.total_amount)}</div>
                  </div>
                </div>

                <div className="absolute bottom-4 right-4">
                  <IconChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
            No invoices found.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{start}</span> to{" "}
          <span className="font-semibold text-slate-900">{end}</span> of{" "}
          <span className="font-semibold text-slate-900">{invoices.length}</span> invoices
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-9 border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-9 border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
