"use client"

import * as React from "react"
import Link from "next/link"
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
  IconAlertTriangle,
  IconChevronRight,
  IconClock,
  IconCoin,
  IconPlus,
  IconSearch,
  IconTool,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type {
  AircraftMaintenanceVisitEntry,
  AircraftMaintenanceVisitsResponse,
} from "@/lib/types/maintenance-history"
import EditMaintenanceHistoryModal from "@/components/aircraft/edit-maintenance-history-modal"
import LogMaintenanceModal from "@/components/aircraft/log-maintenance-modal"

type Props = {
  aircraftId: string
  initialVisits?: AircraftMaintenanceVisitEntry[]
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—"
  const parsed = new Date(dateString)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "—"
  return `${hours.toFixed(1)}h`
}

function getUserName(visit: AircraftMaintenanceVisitEntry): string {
  if (visit.performed_by_user) {
    const name = [
      visit.performed_by_user.first_name,
      visit.performed_by_user.last_name,
    ]
      .filter(Boolean)
      .join(" ")
    return name || visit.performed_by_user.email || "—"
  }
  return visit.technician_name || "—"
}

function getVisitTypeBadge(type: string | null | undefined): { label: string; className: string } {
  const typeLower = type?.toLowerCase() || ""
  switch (typeLower) {
    case "scheduled":
      return {
        label: "SCHEDULED",
        className: "border-emerald-100 bg-emerald-50 text-emerald-600",
      }
    case "unscheduled":
      return {
        label: "UNSCHEDULED",
        className: "border-amber-100 bg-amber-50 text-amber-700",
      }
    case "inspection":
      return {
        label: "INSPECTION",
        className: "border-indigo-100 bg-indigo-50 text-indigo-700",
      }
    case "repair":
      return { label: "REPAIR", className: "border-red-100 bg-red-50 text-red-700" }
    case "modification":
      return {
        label: "MODIFICATION",
        className: "border-violet-100 bg-violet-50 text-violet-700",
      }
    default:
      return {
        label: type?.toUpperCase() || "MAINTENANCE",
        className: "border-slate-200 bg-slate-100 text-slate-600",
      }
  }
}

async function fetchMaintenanceVisits(aircraftId: string): Promise<AircraftMaintenanceVisitEntry[]> {
  const response = await fetch(`/api/maintenance-visits?aircraft_id=${aircraftId}`, {
    method: "GET",
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => ({}))) as Partial<AircraftMaintenanceVisitsResponse> & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(payload.error || "Failed to load maintenance visits")
  }

  return payload.visits ?? []
}

export function AircraftMaintenanceHistoryTab({ aircraftId, initialVisits = [] }: Props) {
  const [visits, setVisits] = React.useState<AircraftMaintenanceVisitEntry[]>(initialVisits)
  const [isLoading, setIsLoading] = React.useState(initialVisits.length === 0)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [selectedVisitId, setSelectedVisitId] = React.useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = React.useState(false)
  const [logModalOpen, setLogModalOpen] = React.useState(false)
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "visit_date", desc: true },
  ])

  const loadVisits = React.useCallback(
    async (showLoader: boolean) => {
      if (!aircraftId) {
        setVisits([])
        setIsLoading(false)
        setError(null)
        return
      }

      if (showLoader) setIsLoading(true)
      setError(null)
      try {
        const next = await fetchMaintenanceVisits(aircraftId)
        setVisits(next)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load maintenance visits")
      } finally {
        setIsLoading(false)
      }
    },
    [aircraftId]
  )

  React.useEffect(() => {
    void loadVisits(initialVisits.length === 0)
  }, [initialVisits.length, loadVisits])

  const filteredVisits = React.useMemo(() => {
    if (!search) return visits
    const searchLower = search.toLowerCase()
    return visits.filter((visit) => {
      const description = visit.description?.toLowerCase() || ""
      const type = visit.visit_type?.toLowerCase() || ""
      const componentName = visit.component?.name?.toLowerCase() || ""
      const technicianName = getUserName(visit).toLowerCase()
      return (
        description.includes(searchLower) ||
        type.includes(searchLower) ||
        componentName.includes(searchLower) ||
        technicianName.includes(searchLower)
      )
    })
  }, [search, visits])

  const columns = React.useMemo<ColumnDef<AircraftMaintenanceVisitEntry>[]>(
    () => [
      {
        accessorKey: "visit_date",
        header: "Visit Date",
        cell: ({ row }) => {
          const visit = row.original
          return (
            <div className="flex flex-col">
              <span className="font-semibold text-slate-900">{formatDate(visit.visit_date)}</span>
              {visit.date_out_of_maintenance ? (
                <span className="text-xs text-slate-600">
                  Out: {formatDate(visit.date_out_of_maintenance)}
                </span>
              ) : null}
            </div>
          )
        },
      },
      {
        accessorKey: "visit_type",
        header: "Type",
        cell: ({ row }) => {
          const { label, className } = getVisitTypeBadge(row.original.visit_type)
          return (
            <Badge variant="outline" className={cn("px-2 py-0.5 text-xs font-medium", className)}>
              {label}
            </Badge>
          )
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <div className="max-w-xs xl:max-w-md">
            <p className="line-clamp-2 font-medium leading-relaxed text-slate-700">
              {row.original.description || "—"}
            </p>
            {row.original.component ? (
              <span className="mt-1 inline-block text-xs font-medium text-indigo-600">
                {row.original.component.name}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "performed_by",
        header: "Technician",
        cell: ({ row }) => (
          <span className="font-medium text-slate-600">{getUserName(row.original)}</span>
        ),
      },
      {
        accessorKey: "hours_at_visit",
        header: "Tach Hours",
        cell: ({ row }) => (
          <span className="font-semibold text-slate-900">
            {formatHours(row.original.hours_at_visit)}
          </span>
        ),
      },
      {
        accessorKey: "total_cost",
        header: () => <div className="text-right">Cost</div>,
        cell: ({ row }) => (
          <div className="text-right font-semibold text-slate-900">
            {formatCurrency(row.original.total_cost)}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            {row.original.booking_id ? (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 px-3 text-xs font-medium"
                onClick={(event) => event.stopPropagation()}
              >
                <Link href={`/bookings/${row.original.booking_id}`}>Booking</Link>
              </Button>
            ) : (
              <span className="text-xs text-slate-500">—</span>
            )}
            <IconChevronRight className="h-4 w-4 text-slate-300" />
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: filteredVisits,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting },
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
  })

  const rowCount = filteredVisits.length
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const pageStart = rowCount === 0 ? 0 : pageIndex * pageSize + 1
  const pageEnd = rowCount === 0 ? 0 : Math.min((pageIndex + 1) * pageSize, rowCount)

  const handleOpenVisit = React.useCallback((visitId: string) => {
    setSelectedVisitId(visitId)
    setEditModalOpen(true)
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-[20px]" />
        <Skeleton className="h-32 w-full rounded-[20px]" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-100 bg-red-50/30 p-12">
        <div className="flex flex-col items-center justify-center gap-3 text-red-600">
          <IconAlertTriangle className="h-10 w-10 opacity-50" />
          <p className="text-sm font-bold">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void loadVisits(true)}>
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Maintenance History</h2>
          <p className="mt-1 text-slate-500">Track and manage maintenance visits for this aircraft.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-auto">
            <IconSearch className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search history..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full border-slate-200 bg-white pl-9 focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900 sm:w-64"
            />
          </div>
          <Button className="bg-slate-900 text-white font-semibold h-10 px-5 hover:bg-slate-800" onClick={() => setLogModalOpen(true)}>
            <IconPlus className="h-4 w-4 mr-2" />
            Log Maintenance
          </Button>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50/50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase",
                      header.id === "total_cost" || header.id === "actions"
                        ? "text-right"
                        : "text-left"
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="group cursor-pointer transition-colors hover:bg-slate-50/50"
                  onClick={() => handleOpenVisit(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-4 py-3.5 align-middle",
                        cell.column.id === "actions" ? "pr-6" : ""
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center font-medium text-slate-500">
                  No maintenance visits recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {table.getRowModel().rows.length > 0 ? (
          table.getRowModel().rows.map((row) => {
            const visit = row.original
            const { label, className } = getVisitTypeBadge(visit.visit_type)
            return (
              <div
                key={row.id}
                className="relative cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
                onClick={() => handleOpenVisit(visit.id)}
              >
                <div className="absolute top-0 bottom-0 left-0 w-1 rounded-l-lg bg-slate-900" />
                <div className="mb-3 flex items-start justify-between pl-2">
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-slate-900">
                      {visit.visit_type || "Maintenance Visit"}
                    </h3>
                    <span className="text-xs text-slate-600">{formatDate(visit.visit_date)}</span>
                  </div>
                  <Badge variant="outline" className={cn("px-2 py-0.5 text-xs font-medium", className)}>
                    {label}
                  </Badge>
                </div>

                {visit.description ? (
                  <div className="mb-3 pl-2">
                    <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
                      {visit.description}
                    </p>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <IconClock className="h-3 w-3" /> Hours
                    </div>
                    <div className="text-sm font-semibold text-slate-700">
                      {formatHours(visit.hours_at_visit)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <IconCoin className="h-3 w-3" /> Cost
                    </div>
                    <div className="text-sm font-semibold text-slate-700">
                      {formatCurrency(visit.total_cost)}
                    </div>
                  </div>
                  {visit.component ? (
                    <div className="col-span-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        <IconTool className="h-3 w-3" /> Component
                      </div>
                      <div className="text-sm font-semibold text-slate-700">{visit.component.name}</div>
                    </div>
                  ) : null}
                </div>

                {visit.booking_id ? (
                  <div className="mt-3 pl-2" onClick={(event) => event.stopPropagation()}>
                    <Button variant="outline" size="sm" asChild className="h-8 px-3 text-xs font-medium">
                      <Link href={`/bookings/${visit.booking_id}`}>Open Booking</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
            No maintenance visits found.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{pageStart}</span> to{" "}
          <span className="font-semibold text-slate-900">{pageEnd}</span> of{" "}
          <span className="font-semibold text-slate-900">{rowCount}</span> visits
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

      <EditMaintenanceHistoryModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        maintenanceVisitId={selectedVisitId}
        onSuccess={() => void loadVisits(true)}
      />

      <LogMaintenanceModal
        open={logModalOpen}
        onOpenChange={setLogModalOpen}
        aircraft_id={aircraftId}
        onSuccess={() => void loadVisits(true)}
      />
    </div>
  )
}
