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
  IconChevronRight,
  IconCircleCheck,
  IconCircleX,
  IconSearch,
  IconShield,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"

import { cn, getUserInitials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { InstructorWithRelations } from "@/lib/types/instructors"

interface InstructorsTableProps {
  instructors: InstructorWithRelations[]
}

function formatLabel(value: string | null | undefined): string {
  if (!value) return "-"

  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function formatDate(value: string | null): string {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getDisplayName(instructor: InstructorWithRelations) {
  const firstName = instructor.user?.first_name ?? instructor.first_name ?? ""
  const lastName = instructor.user?.last_name ?? instructor.last_name ?? ""
  const email = instructor.user?.email ?? ""
  const name = [firstName, lastName].filter(Boolean).join(" ")

  return {
    firstName,
    lastName,
    email,
    name: name || email || "Unknown",
  }
}

function getStatusBadge(status: string): { label: string; className: string } {
  const normalized = status.toLowerCase()

  if (normalized === "approved" || normalized === "active") {
    return {
      label: formatLabel(status),
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    }
  }

  if (normalized === "pending") {
    return {
      label: "Pending",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    }
  }

  if (normalized === "inactive" || normalized === "suspended") {
    return {
      label: formatLabel(status),
      className: "bg-red-50 text-red-700 border-red-200",
    }
  }

  return {
    label: formatLabel(status),
    className: "bg-slate-50 text-slate-700 border-slate-200",
  }
}

function getTeachingBadge(isActivelyInstructing: boolean): { label: string; className: string } {
  if (isActivelyInstructing) {
    return {
      label: "Active",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    }
  }

  return {
    label: "Inactive",
    className: "bg-red-50 text-red-700 border-red-200",
  }
}

export function InstructorsTable({ instructors }: InstructorsTableProps) {
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [isNavigating, startNavigation] = React.useTransition()
  const router = useRouter()

  const navigate = React.useCallback(
    (href: string) => {
      startNavigation(() => {
        router.push(href)
      })
    },
    [router]
  )

  const filteredInstructors = React.useMemo(() => {
    if (!search) return instructors

    const searchLower = search.toLowerCase()

    return instructors.filter((instructor) => {
      const { firstName, lastName, email } = getDisplayName(instructor)
      const fullName = `${firstName} ${lastName}`.trim().toLowerCase()
      const category = instructor.instructor_category?.name?.toLowerCase() ?? ""
      const employment = formatLabel(instructor.employment_type).toLowerCase()
      const status = formatLabel(instructor.status).toLowerCase()

      return (
        firstName.toLowerCase().includes(searchLower) ||
        lastName.toLowerCase().includes(searchLower) ||
        email.toLowerCase().includes(searchLower) ||
        fullName.includes(searchLower) ||
        category.includes(searchLower) ||
        employment.includes(searchLower) ||
        status.includes(searchLower)
      )
    })
  }, [instructors, search])

  const columns = React.useMemo<ColumnDef<InstructorWithRelations>[]>(
    () => [
      {
        id: "instructor",
        header: "Instructor",
        cell: ({ row }) => {
          const instructor = row.original
          const { firstName, lastName, email, name } = getDisplayName(instructor)
          const initials = getUserInitials(firstName, lastName, email)

          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 rounded-md">
                <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold text-slate-900">{name}</span>
                <span className="text-xs text-slate-600">{email || "-"}</span>
              </div>
            </div>
          )
        },
      },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700"
          >
            {row.original.instructor_category?.name ?? "Unrated"}
          </Badge>
        ),
      },
      {
        id: "employment",
        header: "Employment",
        cell: ({ row }) => (
          <span className="text-slate-700">{formatLabel(row.original.employment_type)}</span>
        ),
      },
      {
        id: "status",
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
        id: "teaching",
        header: () => <div className="text-center">Teaching</div>,
        cell: ({ row }) => {
          const { label, className } = getTeachingBadge(row.original.is_actively_instructing)

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
        id: "expires",
        header: () => <div className="text-right">Expires</div>,
        cell: ({ row }) => (
          <div className="text-right text-sm font-medium text-slate-700">
            {formatDate(row.original.expires_at)}
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

  const table = useReactTable<InstructorWithRelations>({
    data: filteredInstructors,
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

  const page = table.getState().pagination
  const total = filteredInstructors.length
  const start = total === 0 ? 0 : page.pageIndex * page.pageSize + 1
  const end = Math.min((page.pageIndex + 1) * page.pageSize, total)

  return (
    <div className={cn("flex flex-col gap-6", isNavigating && "cursor-progress")} aria-busy={isNavigating}>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Instructors</h2>
          <p className="mt-1 text-slate-600">View and manage your training team.</p>
        </div>

        <div className="relative w-full sm:w-auto">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search instructors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full border-slate-200 bg-white pl-9 focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900 sm:w-64"
          />
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
                        header.id === "status" || header.id === "teaching"
                          ? "text-center"
                          : header.id === "expires"
                            ? "text-right"
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
                  onClick={() => navigate(`/instructors/${row.original.user_id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn("px-4 py-3.5 align-middle", cell.column.id === "actions" && "pr-6")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center font-medium text-slate-500">
                  No instructors found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const instructor = row.original
            const { firstName, lastName, email, name } = getDisplayName(instructor)
            const initials = getUserInitials(firstName, lastName, email)
            const { label: statusLabel, className: statusClass } = getStatusBadge(instructor.status)
            const { label: teachingLabel } = getTeachingBadge(instructor.is_actively_instructing)

            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
                onClick={() => navigate(`/instructors/${instructor.user_id}`)}
              >
                <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-lg bg-slate-900" />

                <div className="mb-3 flex items-start justify-between pl-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-md">
                      <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <h3 className="font-semibold text-slate-900">{name}</h3>
                      <span className="text-xs text-slate-600">{email || "-"}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("px-2 py-0.5 text-xs font-medium", statusClass)}>
                    {statusLabel}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <IconShield className="h-3 w-3" /> Category
                    </div>
                    <div className="text-sm font-semibold text-slate-700">
                      {instructor.instructor_category?.name ?? "Unrated"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {instructor.is_actively_instructing ? (
                        <IconCircleCheck className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <IconCircleX className="h-3 w-3 text-red-600" />
                      )}
                      Teaching
                    </div>
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        instructor.is_actively_instructing ? "text-emerald-700" : "text-red-700"
                      )}
                    >
                      {teachingLabel}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pl-2 text-xs text-slate-500">
                  Employment: {formatLabel(instructor.employment_type)} | Expires: {formatDate(instructor.expires_at)}
                </div>

                <div className="absolute bottom-4 right-4">
                  <IconChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
            No instructors found.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{start}</span> to{" "}
          <span className="font-semibold text-slate-900">{end}</span> of{" "}
          <span className="font-semibold text-slate-900">{total}</span> instructors
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
