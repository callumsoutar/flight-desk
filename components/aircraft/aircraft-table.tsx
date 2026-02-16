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
import { IconChevronRight, IconClock, IconPlus, IconSearch, IconTag } from "@tabler/icons-react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AircraftWithType } from "@/lib/types/aircraft"

interface AircraftTableProps {
  aircraft: AircraftWithType[]
}

function getStatusBadge(status: string | null): { label: string; className: string } {
  if (!status) {
    return { label: "Unknown", className: "bg-slate-50 text-slate-700 border-slate-200" }
  }

  const statusLower = status.toLowerCase()
  if (statusLower === "active") {
    return { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  }
  if (statusLower === "maintenance" || statusLower === "down") {
    return { label: status.toUpperCase(), className: "bg-amber-50 text-amber-700 border-amber-200" }
  }

  return {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    className: "bg-slate-50 text-slate-700 border-slate-200",
  }
}

function formatTotalHours(hours: number | null): string {
  if (hours === null || hours === undefined) {
    return "0.0h"
  }
  return `${hours.toFixed(1)}h`
}

export function AircraftTable({ aircraft }: AircraftTableProps) {
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const router = useRouter()
  const { role } = useAuth()

  const filteredAircraft = React.useMemo(() => {
    if (!search) return aircraft

    const searchLower = search.toLowerCase()
    return aircraft.filter((item) => {
      const registration = item.registration?.toLowerCase() || ""
      const model = item.model?.toLowerCase() || ""
      const type = item.type?.toLowerCase() || ""
      const aircraftTypeName = item.aircraft_type?.name?.toLowerCase() || ""

      return (
        registration.includes(searchLower) ||
        model.includes(searchLower) ||
        type.includes(searchLower) ||
        aircraftTypeName.includes(searchLower)
      )
    })
  }, [aircraft, search])

  const columns = React.useMemo<ColumnDef<AircraftWithType>[]>(
    () => [
      {
        accessorKey: "registration",
        header: "Aircraft",
        cell: ({ row }) => {
          const item = row.original
          const registration = item.registration || ""
          const model = item.model || ""
          const imageUrl = item.aircraft_image_url

          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 rounded-md">
                {imageUrl ? <AvatarImage src={imageUrl} alt={registration} /> : null}
                <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-600">
                  {registration ? registration.substring(0, 2).toUpperCase() : "??"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold text-slate-900">{registration}</span>
                {model ? <span className="text-xs text-slate-600">{model}</span> : null}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
          const type = row.original.type || row.original.aircraft_type?.name || ""
          return <span className="text-slate-700">{type || "-"}</span>
        },
      },
      {
        accessorKey: "status",
        header: () => <div className="text-center">Status</div>,
        cell: ({ row }) => {
          const { label, className } = getStatusBadge(row.original.status)

          return (
            <div className="flex justify-center">
              <Badge variant="outline" className={cn("px-2 py-0.5 text-xs font-medium", className)}>
                {label}
              </Badge>
            </div>
          )
        },
      },
      {
        accessorKey: "total_time_in_service",
        header: () => <div className="text-right">Total Hours</div>,
        cell: ({ row }) => (
          <div className="text-right font-semibold text-slate-900">
            {formatTotalHours(row.original.total_time_in_service)}
          </div>
        ),
      },
      {
        id: "actions",
        cell: () => (
          <div className="flex justify-end">
            <IconChevronRight className="h-4 w-4 text-slate-300" />
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable<AircraftWithType>({
    data: filteredAircraft,
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

  const canAddAircraft = role ? !["member", "student"].includes(role.toLowerCase()) : false

  const page = table.getState().pagination
  const total = filteredAircraft.length
  const start = total === 0 ? 0 : page.pageIndex * page.pageSize + 1
  const end = Math.min((page.pageIndex + 1) * page.pageSize, total)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Aircraft</h2>
          <p className="mt-1 text-slate-600">Manage your fleet and maintenance schedules.</p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <div className="relative w-full sm:w-auto">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search aircraft..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full border-slate-200 bg-white pl-9 focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900 sm:w-64"
            />
          </div>
          {canAddAircraft ? (
            <Button
              variant="outline"
              className="h-10 w-full border-slate-200 px-5 text-slate-700 hover:bg-slate-50 sm:w-auto"
              onClick={() => router.push("/aircraft/reorder")}
            >
              Reorder
            </Button>
          ) : null}
          {canAddAircraft ? (
            <Button
              className="h-10 w-full bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800 sm:w-auto"
              onClick={() => router.push("/aircraft/new")}
            >
              <IconPlus className="mr-2 h-4 w-4" />
              Add Aircraft
            </Button>
          ) : null}
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
                      className={cn(
                        "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600",
                        header.id === "total_time_in_service"
                          ? "text-right"
                          : header.id === "status"
                            ? "text-center"
                            : "text-left"
                      )}
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
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="group cursor-pointer transition-colors hover:bg-slate-50/50"
                  onClick={() => router.push(`/aircraft/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn("px-4 py-3.5 align-middle", cell.column.id === "actions" ? "pr-6" : "")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center font-medium text-slate-500">
                  No aircraft found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const item = row.original
            const { label, className } = getStatusBadge(item.status)

            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
                onClick={() => router.push(`/aircraft/${item.id}`)}
              >
                <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-lg bg-slate-900" />

                <div className="mb-3 flex items-start justify-between pl-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-md">
                      {item.aircraft_image_url ? (
                        <AvatarImage src={item.aircraft_image_url} alt={item.registration} />
                      ) : null}
                      <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-600">
                        {item.registration?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <h3 className="font-semibold text-slate-900">{item.registration}</h3>
                      <span className="text-xs text-slate-600">{item.model || "Unknown Model"}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("px-2 py-0.5 text-xs font-medium", className)}>
                    {label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <IconTag className="h-3 w-3" /> Type
                    </div>
                    <div className="text-sm font-semibold text-slate-700">
                      {item.type || item.aircraft_type?.name || "-"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <IconClock className="h-3 w-3" /> Total Hours
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {formatTotalHours(item.total_time_in_service)}
                    </div>
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
            No aircraft found.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{start}</span> to{" "}
          <span className="font-semibold text-slate-900">{end}</span> of{" "}
          <span className="font-semibold text-slate-900">{total}</span> aircraft
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
