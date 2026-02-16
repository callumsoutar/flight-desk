"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table"
import {
  IconAlertCircle,
  IconCalendar,
  IconCalendarPlus,
  IconCircleCheck,
  IconClock,
  IconPlane,
  IconSchool,
  IconSearch,
  IconUser,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BookingStatus, BookingType, BookingWithRelations } from "@/lib/types/bookings"

interface BookingsTableProps {
  bookings: BookingWithRelations[]
  onFiltersChange?: (filters: {
    search?: string
    status?: BookingStatus[]
    booking_type?: BookingType[]
  }) => void
  activeTab: string
  onTabChange: (tab: string) => void
  tabCounts: {
    all: number
    today: number
    flying: number
    unconfirmed: number
  }
}

function getStatusBadgeVariant(status: BookingStatus) {
  switch (status) {
    case "confirmed":
    case "flying":
      return "default"
    case "briefing":
    case "unconfirmed":
      return "secondary"
    case "cancelled":
      return "destructive"
    default:
      return "outline"
  }
}

function getStatusLabel(status: BookingStatus) {
  if (status === "unconfirmed") return "Unconfirmed"
  if (status === "confirmed") return "Confirmed"
  if (status === "briefing") return "Briefing"
  if (status === "flying") return "Flying"
  if (status === "complete") return "Complete"
  if (status === "cancelled") return "Cancelled"
  return status
}

function getBookingTypeLabel(type: BookingType) {
  if (type === "groundwork") return "Ground Work"
  return type.charAt(0).toUpperCase() + type.slice(1)
}

const columns: ColumnDef<BookingWithRelations>[] = [
  {
    id: "aircraft",
    header: () => (
      <div className="flex items-center gap-2">
        <IconPlane className="h-4 w-4 text-muted-foreground" />
        <span>Aircraft</span>
      </div>
    ),
    cell: ({ row }) => {
      const aircraft = row.original.aircraft
      if (!aircraft) return <span className="text-muted-foreground">-</span>

      return (
        <div className="font-medium">
          <div className="flex items-center gap-1.5">
            {aircraft.manufacturer ? `${aircraft.manufacturer} ` : ""}
            {aircraft.type}
            {aircraft.model ? ` - ${aircraft.model}` : ""}
          </div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{aircraft.registration}</div>
        </div>
      )
    },
  },
  {
    accessorKey: "start_time",
    header: () => (
      <div className="flex items-center gap-2">
        <IconCalendar className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">Date</span>
      </div>
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.start_time)
      return (
        <div>
          <div className="font-medium">
            {date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="hidden text-xs text-muted-foreground sm:block">
            {date.toLocaleDateString("en-US", { year: "numeric" })}
          </div>
        </div>
      )
    },
  },
  {
    id: "time",
    header: () => (
      <div className="flex items-center gap-2">
        <IconClock className="h-4 w-4 text-muted-foreground" />
        <span>Time</span>
      </div>
    ),
    cell: ({ row }) => {
      const start = new Date(row.original.start_time)
      const end = new Date(row.original.end_time)
      return (
        <div className="font-medium">
          {start.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
          <span className="mx-1 text-muted-foreground">-</span>
          {end.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
      )
    },
  },
  {
    accessorKey: "booking_type",
    header: () => <span className="hidden lg:inline">Type</span>,
    cell: ({ row }) => (
      <Badge variant="outline" className="hidden font-medium lg:inline-flex">
        {getBookingTypeLabel(row.original.booking_type)}
      </Badge>
    ),
  },
  {
    id: "student",
    header: () => (
      <div className="flex items-center gap-2">
        <IconUser className="h-4 w-4 text-muted-foreground" />
        <span className="hidden md:inline">Student</span>
      </div>
    ),
    cell: ({ row }) => {
      const student = row.original.student
      if (!student) return <span className="text-muted-foreground">-</span>

      const name = [student.first_name, student.last_name].filter(Boolean).join(" ")
      return <div className="font-medium">{name || student.email}</div>
    },
  },
  {
    id: "instructor",
    header: () => (
      <div className="flex items-center gap-2">
        <IconSchool className="h-4 w-4 text-muted-foreground" />
        <span className="hidden md:inline">Instructor</span>
      </div>
    ),
    cell({ row }) {
      const instructor = row.original.instructor
      if (!instructor) return <span className="text-muted-foreground">-</span>

      const firstName = instructor.user?.first_name ?? instructor.first_name
      const lastName = instructor.user?.last_name ?? instructor.last_name
      const name = [firstName, lastName].filter(Boolean).join(" ")

      return <div className="font-medium">{name || instructor.user?.email || "-"}</div>
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status
      const variant = getStatusBadgeVariant(status)
      const label = getStatusLabel(status)
      const isFlying = status === "flying"
      const isUnconfirmed = status === "unconfirmed"
      const isConfirmed = status === "confirmed"
      const isComplete = status === "complete"

      return (
        <Badge
          variant={variant}
          className={cn(
            "font-medium",
            isFlying && "border-orange-600 bg-orange-500 text-white shadow-sm",
            isUnconfirmed && "border-amber-200 bg-amber-500/10 text-amber-700",
            isConfirmed && "border-blue-700 bg-blue-600 text-white shadow-sm",
            isComplete && "border-green-700 bg-green-600 text-white shadow-sm"
          )}
        >
          {isFlying ? <IconPlane className="mr-1 h-3 w-3" /> : null}
          {isUnconfirmed ? <IconAlertCircle className="mr-1 h-3 w-3" /> : null}
          {isConfirmed ? <IconCircleCheck className="mr-1 h-3 w-3" /> : null}
          {label}
        </Badge>
      )
    },
  },
]

function BookingCard({ booking }: { booking: BookingWithRelations }) {
  const router = useRouter()

  const start = new Date(booking.start_time)
  const end = new Date(booking.end_time)
  const status = booking.status
  const variant = getStatusBadgeVariant(status)
  const label = getStatusLabel(status)

  const studentName = booking.student
    ? `${booking.student.first_name ?? ""} ${booking.student.last_name ?? ""}`.trim() || booking.student.email
    : null

  const instructorName = booking.instructor
    ? `${booking.instructor.user?.first_name ?? booking.instructor.first_name ?? ""} ${booking.instructor.user?.last_name ?? booking.instructor.last_name ?? ""}`.trim() || booking.instructor.user?.email || null
    : null

  return (
    <div
      className="group relative cursor-pointer border-b bg-background transition-all last:border-b-0 hover:bg-accent/5 active:scale-[0.98]"
      onClick={() => router.push(`/bookings/${booking.id}`)}
    >
      <div className="px-4 py-3">
        <div className="flex items-start gap-4">
          <div className="flex min-w-[50px] flex-col text-sm font-semibold text-foreground">
            <span>
              {start.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
            <span className="text-muted-foreground">
              {end.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-base font-bold">
                  {booking.aircraft?.registration || getBookingTypeLabel(booking.booking_type)}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {booking.aircraft
                    ? `${booking.aircraft.manufacturer ?? ""} ${booking.aircraft.type}`.trim()
                    : "No Aircraft"}
                </span>
              </div>

              <Badge variant={variant} className="shrink-0 rounded-full px-3 py-0.5 text-xs font-medium">
                {label}
              </Badge>
            </div>

            {studentName || instructorName ? (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <IconUser className="h-4 w-4 shrink-0" />
                <span className="truncate">{[studentName, instructorName].filter(Boolean).join(", ")}</span>
              </div>
            ) : null}

            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <IconSchool className="h-4 w-4 shrink-0" />
              <span className="truncate">{getBookingTypeLabel(booking.booking_type)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BookingsTable({
  bookings,
  onFiltersChange,
  activeTab,
  onTabChange,
  tabCounts,
}: BookingsTableProps) {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = React.useState(false)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [typeFilter, setTypeFilter] = React.useState<string>("all")
  const router = useRouter()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(globalFilter)
    }, 300)

    return () => clearTimeout(timer)
  }, [globalFilter])

  const filteredBookings = React.useMemo(() => {
    let filtered = bookings

    if (statusFilter !== "all") {
      filtered = filtered.filter((b) => b.status === statusFilter)
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((b) => b.booking_type === typeFilter)
    }

    return filtered
  }, [bookings, statusFilter, typeFilter])

  const table = useReactTable({
    data: filteredBookings,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  React.useEffect(() => {
    onFiltersChange?.({
      search: debouncedSearch || undefined,
      status: statusFilter !== "all" ? [statusFilter as BookingStatus] : undefined,
      booking_type: typeFilter !== "all" ? [typeFilter as BookingType] : undefined,
    })
  }, [debouncedSearch, onFiltersChange, statusFilter, typeFilter])

  const tabs = [
    { id: "all", label: "All" },
    { id: "today", label: "Today" },
    { id: "flying", label: "Flying" },
    { id: "unconfirmed", label: "Unconfirmed" },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Bookings</h2>
          <p className="mt-1 text-slate-600">View and manage all flight bookings.</p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <div className="relative w-full sm:w-auto">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search bookings..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-10 w-full border-slate-200 bg-white pl-9 focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900 sm:w-64"
            />
          </div>
          <Button
            className="h-10 w-full bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800 sm:w-auto"
            onClick={() => router.push("/bookings/new")}
          >
            <IconCalendarPlus className="mr-2 h-4 w-4" />
            New Booking
          </Button>
        </div>
      </div>

      <div className="relative -mx-4 px-4 md:mx-0 md:px-0">
        <div className="scrollbar-hide flex items-center gap-1 overflow-x-auto border-b border-slate-200">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            const count = tabCounts[tab.id as keyof typeof tabCounts]

            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-all active:scale-95",
                  isActive
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                    isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-full border-slate-200 sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="unconfirmed">Unconfirmed</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="briefing">Briefing</SelectItem>
            <SelectItem value="flying">Flying</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-10 w-full border-slate-200 sm:w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="flight">Flight</SelectItem>
            <SelectItem value="groundwork">Ground Work</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mounted && isMobile ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {filteredBookings.length > 0 ? (
            filteredBookings
              .slice(
                table.getState().pagination.pageIndex * table.getState().pagination.pageSize,
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize
              )
              .map((booking) => <BookingCard key={booking.id} booking={booking} />)
          ) : (
            <div className="p-12">
              <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                <IconPlane className="h-10 w-10 opacity-50" />
                <p className="text-sm font-medium">No bookings found</p>
                <p className="text-center text-xs">Try adjusting your filters</p>
              </div>
            </div>
          )}
        </div>
      ) : mounted ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="-mx-1 overflow-x-auto sm:mx-0">
            <div className="inline-block min-w-full align-middle px-1 sm:px-0">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow
                      key={headerGroup.id}
                      className="border-b border-slate-200 bg-slate-50/50 hover:bg-slate-50/50"
                    >
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className="h-12 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-slate-600"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="group cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/50"
                        onClick={(e) => {
                          const target = e.target as HTMLElement
                          if (!target.closest("button, a, [role='button'], input, select")) {
                            router.push(`/bookings/${row.original.id}`)
                          }
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="px-4 py-3.5">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                          <IconPlane className="h-8 w-8 opacity-50" />
                          <p className="text-sm font-medium">No bookings found</p>
                          <p className="text-xs">Try adjusting your filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="p-8 text-center text-slate-500">Loading...</div>
        </div>
      )}

      <div className="px-2 pt-2 sm:flex sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{filteredBookings.length ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0}</span> to{" "}
          <span className="font-semibold text-slate-900">
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              filteredBookings.length
            )}
          </span>{" "}
          of <span className="font-semibold text-slate-900">{filteredBookings.length}</span> bookings
        </div>

        <div className="mt-3 flex items-center gap-2 sm:mt-0">
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
