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
import { IconAlertTriangle, IconCalendar, IconChevronRight, IconPlus, IconUser } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AddObservationModal } from "@/components/aircraft/add-observation-modal"
import { ResolveObservationModal } from "@/components/aircraft/resolve-observation-modal"
import { ViewObservationModal } from "@/components/aircraft/view-observation-modal"
import { cn } from "@/lib/utils"
import type { ObservationWithUsers } from "@/lib/types/aircraft-detail"

type Props = {
  aircraftId: string
  observations: ObservationWithUsers[]
}

const priorityBadge: Record<string, { label: string; className: string }> = {
  low: { label: "LOW", className: "border-emerald-100 bg-emerald-50 text-emerald-600" },
  medium: { label: "MEDIUM", className: "border-amber-100 bg-amber-50 text-amber-700" },
  high: { label: "HIGH", className: "border-red-100 bg-red-50 text-red-700" },
}

const stageBadge: Record<string, { label: string; className: string }> = {
  open: { label: "OPEN", className: "border-indigo-100 bg-indigo-50 text-indigo-700" },
  investigation: {
    label: "INVESTIGATING",
    className: "border-orange-100 bg-orange-50 text-orange-700",
  },
  resolution: {
    label: "RESOLVING",
    className: "border-violet-100 bg-violet-50 text-violet-700",
  },
  closed: { label: "CLOSED", className: "border-slate-200 bg-slate-100 text-slate-600" },
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

function getUserName(observation: ObservationWithUsers) {
  if (!observation.reported_by_user) return "Unknown"
  const name = [observation.reported_by_user.first_name, observation.reported_by_user.last_name]
    .filter(Boolean)
    .join(" ")
  return name || observation.reported_by_user.email || "Unknown"
}

function getAssignedName(observation: ObservationWithUsers) {
  if (!observation.assigned_to_user) return "—"
  const name = [observation.assigned_to_user.first_name, observation.assigned_to_user.last_name]
    .filter(Boolean)
    .join(" ")
  return name || observation.assigned_to_user.email || "—"
}

export function AircraftObservationsTable({ aircraftId, observations }: Props) {
  const [allObservations, setAllObservations] = React.useState<ObservationWithUsers[]>(observations)
  const [view, setView] = React.useState<"open" | "all">("open")
  const [addModalOpen, setAddModalOpen] = React.useState(false)
  const [selectedObservationId, setSelectedObservationId] = React.useState<string | null>(null)
  const [resolveObservationId, setResolveObservationId] = React.useState<string | null>(null)
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "reported_date", desc: true },
  ])

  React.useEffect(() => {
    setAllObservations(observations)
  }, [observations])

  const refreshObservations = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/observations?aircraft_id=${aircraftId}`, {
        cache: "no-store",
      })
      if (!res.ok) return
      const data = (await res.json()) as ObservationWithUsers[]
      setAllObservations(Array.isArray(data) ? data : [])
    } catch {
      // no-op; existing data remains visible
    }
  }, [aircraftId])

  const filteredObservations = React.useMemo(() => {
    if (view === "all") return allObservations
    return allObservations.filter((observation) => observation.stage !== "closed")
  }, [allObservations, view])

  const columns = React.useMemo<ColumnDef<ObservationWithUsers>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Observation",
        cell: ({ row }) => (
          <div className="relative pl-2">
            <span className="font-semibold text-slate-900">{row.original.name}</span>
            <p className="mt-0.5 text-xs text-slate-600">
              {formatDate(row.original.reported_date || row.original.created_at)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "stage",
        header: "Stage",
        cell: ({ row }) => {
          const stage = row.original.stage || "open"
          const { label, className } = stageBadge[stage] || stageBadge.open
          return (
            <Badge variant="outline" className={cn("px-2 py-0.5 text-xs font-medium uppercase", className)}>
              {label}
            </Badge>
          )
        },
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => {
          const priority = row.original.priority || "medium"
          const { label, className } = priorityBadge[priority] || priorityBadge.medium
          return (
            <Badge variant="outline" className={cn("px-2 py-0.5 text-xs font-medium uppercase", className)}>
              {label}
            </Badge>
          )
        },
      },
      {
        id: "reported_date",
        header: "Reported",
        accessorFn: (row) => row.reported_date || row.created_at,
        cell: ({ row }) => (
          <span className="font-medium text-slate-600">
            {formatDate(row.original.reported_date || row.original.created_at)}
          </span>
        ),
      },
      {
        id: "reported_by",
        header: "Reported By",
        cell: ({ row }) => <span className="font-medium text-slate-600">{getUserName(row.original)}</span>,
      },
      {
        id: "assigned_to",
        header: "Assigned To",
        cell: ({ row }) => <span className="font-medium text-slate-600">{getAssignedName(row.original)}</span>,
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            {row.original.stage !== "closed" ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                onClick={(event) => {
                  event.stopPropagation()
                  setResolveObservationId(row.original.id)
                }}
              >
                Resolve
              </Button>
            ) : (
              <span className="text-xs text-slate-500">—</span>
            )}
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: filteredObservations,
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

  return (
    <div className="mt-8 flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Observations</h2>
          <p className="mt-1 text-sm text-slate-600">Track and review aircraft observations and maintenance issues.</p>
        </div>
        <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <div className="flex w-full items-center gap-1 rounded-lg bg-slate-100/50 p-1 sm:w-auto">
            <button
              onClick={() => setView("open")}
              className={cn(
                "flex-1 rounded-lg px-4 py-2 text-xs font-medium transition-all sm:flex-none",
                view === "open"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
              )}
            >
              Open
            </button>
            <button
              onClick={() => setView("all")}
              className={cn(
                "flex-1 rounded-lg px-4 py-2 text-xs font-medium transition-all sm:flex-none",
                view === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
              )}
            >
              All
            </button>
          </div>
          <Button
            className="h-10 w-full bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800 sm:w-auto"
            onClick={() => setAddModalOpen(true)}
          >
            <IconPlus className="mr-2 h-4 w-4" />
            Add Observation
          </Button>
        </div>
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
                      className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const priority = row.original.priority || "medium"
                const borderClass = cn(
                  "absolute top-0 bottom-0 left-0 w-1",
                  priority === "high" && "bg-red-500",
                  priority === "medium" && "bg-amber-400",
                  priority === "low" && "bg-emerald-400"
                )

                return (
                  <tr
                    key={row.id}
                    className="group cursor-pointer transition-colors hover:bg-slate-50/50"
                    onClick={() => setSelectedObservationId(row.original.id)}
                  >
                    {row.getVisibleCells().map((cell, index) => (
                      <td
                        key={cell.id}
                        className={cn("px-4 py-3.5 align-middle", index === 0 && "relative")}
                      >
                        {index === 0 ? <div className={borderClass} /> : null}
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 py-12 text-center font-medium text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <IconAlertTriangle className="h-8 w-8 opacity-20" />
                    <p>No observations found.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const observation = row.original
            const stage = stageBadge[observation.stage] || stageBadge.open
            const priority = priorityBadge[observation.priority || "medium"] || priorityBadge.medium
            const priorityColor =
              observation.priority === "high"
                ? "bg-red-500"
                : observation.priority === "low"
                  ? "bg-emerald-400"
                  : "bg-amber-400"

            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
                onClick={() => setSelectedObservationId(observation.id)}
              >
                <div className={cn("absolute top-0 bottom-0 left-0 w-1", priorityColor)} />

                <div className="mb-3 flex items-start justify-between pl-2">
                  <div className="flex-1 pr-2">
                    <h3 className="font-semibold text-slate-900">{observation.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline" className={cn("px-2 py-0.5 text-xs font-medium", stage.className)}>
                        {stage.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("px-2 py-0.5 text-xs font-medium", priority.className)}
                      >
                        {priority.label}
                      </Badge>
                    </div>
                  </div>
                  <IconChevronRight className="h-4 w-4 text-slate-400" />
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <IconCalendar className="h-3 w-3" /> Reported
                    </div>
                    <div className="text-sm font-semibold text-slate-700">
                      {formatDate(observation.reported_date || observation.created_at)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <IconUser className="h-3 w-3" /> By
                    </div>
                    <div className="truncate text-sm font-semibold text-slate-900">{getUserName(observation)}</div>
                  </div>
                </div>

                {observation.stage !== "closed" ? (
                  <div className="mt-4 border-t border-slate-100 pt-4 pl-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 w-full border-slate-200 font-medium text-slate-600 active:bg-slate-50"
                      onClick={(event) => {
                        event.stopPropagation()
                        setResolveObservationId(observation.id)
                      }}
                    >
                      Resolve Observation
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
            <div className="flex flex-col items-center justify-center gap-2">
              <IconAlertTriangle className="h-8 w-8 opacity-20" />
              <p>No observations found.</p>
            </div>
          </div>
        )}
      </div>

      {filteredObservations.length > 0 ? (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm font-medium text-slate-500">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              filteredObservations.length
            )}{" "}
            of {filteredObservations.length} observations
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <AddObservationModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        aircraftId={aircraftId}
        onCreated={(observation) => {
          setAllObservations((prev) => [observation, ...prev])
        }}
      />

      {selectedObservationId ? (
        <ViewObservationModal
          open={Boolean(selectedObservationId)}
          onClose={() => setSelectedObservationId(null)}
          observationId={selectedObservationId}
          refresh={refreshObservations}
        />
      ) : null}

      {resolveObservationId ? (
        <ResolveObservationModal
          open={Boolean(resolveObservationId)}
          onClose={() => setResolveObservationId(null)}
          observationId={resolveObservationId}
          refresh={refreshObservations}
        />
      ) : null}
    </div>
  )
}
