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
  IconAlertCircle,
  IconClock,
  IconEdit,
  IconFilter,
  IconPackage,
  IconPlus,
  IconSearch,
  IconSelector,
  IconSortAscending,
  IconSortDescending,
  IconUserCheck,
  IconX,
} from "@tabler/icons-react"
import { MoreVertical } from "lucide-react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import {
  EQUIPMENT_TYPE_OPTIONS,
  type EquipmentType,
  type EquipmentWithIssuance,
} from "@/lib/types/equipment"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type EquipmentTableProps = {
  equipment: EquipmentWithIssuance[]
  onIssue?: (equipment: EquipmentWithIssuance) => void
  onReturn?: (equipment: EquipmentWithIssuance) => void
  onLogUpdate?: (equipment: EquipmentWithIssuance) => void
  onAdd?: () => void
}

function getStatusBadge(status: string | null, isIssued: boolean): { label: string; className: string } {
  if (isIssued) {
    return { label: "Issued", className: "border-blue-200 bg-blue-50 text-blue-700" }
  }

  if (!status) {
    return { label: "Unknown", className: "border-slate-200 bg-slate-50 text-slate-700" }
  }

  const statusLower = status.toLowerCase()
  if (statusLower === "active") {
    return { label: "Active", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
  }
  if (statusLower === "maintenance") {
    return { label: "Maintenance", className: "border-amber-200 bg-amber-50 text-amber-700" }
  }
  if (statusLower === "lost") {
    return { label: "Lost", className: "border-red-200 bg-red-50 text-red-700" }
  }
  if (statusLower === "retired") {
    return { label: "Retired", className: "border-slate-200 bg-slate-50 text-slate-700" }
  }

  return {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    className: "border-slate-200 bg-slate-50 text-slate-700",
  }
}

function formatIssuedTo(equipment: EquipmentWithIssuance): string {
  if (!equipment.current_issuance || !equipment.issued_to_user) {
    return "-"
  }

  const user = equipment.issued_to_user
  if (user.first_name || user.last_name) {
    return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
  }

  return user.email ?? "-"
}

function formatOverdueableDate(date: Date | string | null): React.ReactNode {
  if (!date) return <span className="text-slate-500">-</span>

  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return <span className="text-slate-500">-</span>

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkDate = new Date(d)
  checkDate.setHours(0, 0, 0, 0)

  const isOverdue = checkDate < today
  const diffTime = Math.abs(today.getTime() - checkDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        {isOverdue ? <IconAlertCircle className="h-3.5 w-3.5 text-red-600" /> : null}
        <span className={cn("text-sm font-medium", isOverdue ? "text-red-600" : "text-slate-700")}>
          {d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>
      {isOverdue ? (
        <span className="text-[10px] font-medium uppercase tracking-tight text-red-500">
          Due {diffDays} {diffDays === 1 ? "day" : "days"} ago
        </span>
      ) : null}
    </div>
  )
}

function formatExpectedReturn(equipment: EquipmentWithIssuance): React.ReactNode {
  return formatOverdueableDate(equipment.current_issuance?.expected_return || null)
}

function formatNextDue(equipment: EquipmentWithIssuance): React.ReactNode {
  return formatOverdueableDate(equipment.latest_update?.next_due_at || null)
}

export function EquipmentTable({
  equipment,
  onIssue,
  onReturn,
  onLogUpdate,
  onAdd,
}: EquipmentTableProps) {
  const router = useRouter()
  const [isNavigating, startNavigation] = React.useTransition()
  const [search, setSearch] = React.useState("")
  const [selectedType, setSelectedType] = React.useState<EquipmentType | "all">("all")
  const [showIssuedOnly, setShowIssuedOnly] = React.useState(false)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const { role } = useAuth()
  const navigate = React.useCallback(
    (href: string) => {
      startNavigation(() => {
        router.push(href)
      })
    },
    [router]
  )

  const filteredEquipment = React.useMemo(() => {
    return equipment.filter((item) => {
      const searchLower = search.toLowerCase()
      const matchesSearch =
        !search ||
        (item.name?.toLowerCase() || "").includes(searchLower) ||
        (item.serial_number?.toLowerCase() || "").includes(searchLower) ||
        (item.type?.toLowerCase() || "").includes(searchLower)

      const matchesType = selectedType === "all" || item.type === selectedType
      const matchesIssuance = !showIssuedOnly || Boolean(item.current_issuance)

      return matchesSearch && matchesType && matchesIssuance
    })
  }, [equipment, search, selectedType, showIssuedOnly])

  const columns = React.useMemo<ColumnDef<EquipmentWithIssuance>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const item = row.original
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-100">
                <IconPackage className="h-4 w-4 text-slate-600" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-slate-900">{item.name}</span>
                {item.serial_number ? <span className="text-xs text-slate-600">{item.serial_number}</span> : null}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "label",
        header: "Label",
        cell: ({ row }) => <span className="text-slate-700">{row.original.label || "-"}</span>,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <span className="capitalize text-slate-700">{row.original.type || "-"}</span>,
      },
      {
        accessorKey: "status",
        header: () => <div className="text-center">Status</div>,
        cell: ({ row }) => {
          const item = row.original
          const isIssued = Boolean(item.current_issuance)
          const { label, className } = getStatusBadge(item.status, isIssued)

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
        id: "issued_to",
        header: "Issued To",
        cell: ({ row }) => <span className="text-slate-700">{formatIssuedTo(row.original)}</span>,
      },
      {
        id: "expected_return",
        header: "Expected Return",
        cell: ({ row }) => <div>{formatExpectedReturn(row.original)}</div>,
      },
      {
        id: "next_due",
        header: "Next Update Due",
        cell: ({ row }) => <div>{formatNextDue(row.original)}</div>,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.latest_update?.next_due_at
            ? new Date(rowA.original.latest_update.next_due_at).getTime()
            : Number.POSITIVE_INFINITY
          const b = rowB.original.latest_update?.next_due_at
            ? new Date(rowB.original.latest_update.next_due_at).getTime()
            : Number.POSITIVE_INFINITY
          return a - b
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const item = row.original
          const isIssued = Boolean(item.current_issuance)

          return (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="outline" className="hover:bg-slate-100">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isIssued && onReturn ? (
                    <DropdownMenuItem onClick={() => onReturn?.(item)}>
                      <IconAlertCircle className="mr-2 h-4 w-4" /> Return
                    </DropdownMenuItem>
                  ) : onIssue ? (
                    <DropdownMenuItem onClick={() => onIssue?.(item)}>
                      <IconClock className="mr-2 h-4 w-4" /> Issue
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={() => onLogUpdate?.(item)}>
                    <IconPackage className="mr-2 h-4 w-4" /> Log Update
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`/equipment/${item.id}`)}>
                    <IconEdit className="mr-2 h-4 w-4" /> View Details
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [navigate, onIssue, onLogUpdate, onReturn]
  )

  const table = useReactTable<EquipmentWithIssuance>({
    data: filteredEquipment,
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

  const canAddEquipment = role ? !["member", "student"].includes(role.toLowerCase()) : false

  const issuedCount = React.useMemo(() => {
    return equipment.filter((item) => Boolean(item.current_issuance)).length
  }, [equipment])

  const page = table.getState().pagination
  const total = filteredEquipment.length
  const start = total === 0 ? 0 : page.pageIndex * page.pageSize + 1
  const end = Math.min((page.pageIndex + 1) * page.pageSize, total)

  return (
    <div className={cn("flex flex-col gap-6", isNavigating && "cursor-progress")} aria-busy={isNavigating}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Equipment</h2>
            <p className="mt-1 text-sm text-slate-600">Manage inventory, maintenance, and issuance tracking.</p>
          </div>

          {canAddEquipment ? (
            <Button
              className="h-10 bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800"
              onClick={onAdd}
            >
              <IconPlus className="mr-2 h-4 w-4" />
              Add Equipment
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 shadow-sm sm:flex-row">
          <div className="relative w-full flex-1">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name, serial, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full border-slate-200 bg-white pl-10 pr-4 focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900"
            />
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="hidden h-6 w-px bg-slate-200 sm:block" />

            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as EquipmentType | "all")}>
              <SelectTrigger className="h-10 w-full border-slate-200 sm:w-[180px]">
                <div className="flex items-center gap-2">
                  <IconFilter className="h-4 w-4 text-slate-400" />
                  <SelectValue placeholder="All Types" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={showIssuedOnly ? "default" : "outline"}
              onClick={() => setShowIssuedOnly((p) => !p)}
              className={cn(
                "h-10 gap-2 whitespace-nowrap",
                showIssuedOnly
                  ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              <IconUserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Issued Only</span>
              <Badge
                variant="secondary"
                className={cn(
                  "ml-1 h-5 min-w-5 px-1.5 text-xs font-semibold",
                  showIssuedOnly
                    ? "border-blue-400 bg-blue-500 text-white"
                    : "border-slate-200 bg-slate-100 text-slate-700"
                )}
              >
                {issuedCount}
              </Badge>
            </Button>

            {search || selectedType !== "all" || showIssuedOnly ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSearch("")
                  setSelectedType("all")
                  setShowIssuedOnly(false)
                }}
                className="h-10 w-10 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <IconX className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="group border-b border-slate-200 bg-slate-50/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <React.Fragment key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600",
                        header.column.getCanSort() && "cursor-pointer select-none hover:text-slate-900",
                        header.id === "status" ? "text-center" : "text-left"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className={cn("flex items-center gap-1", header.id === "status" && "justify-center")}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() ? (
                          <div className="w-3">
                            {
                              {
                                asc: <IconSortAscending className="h-3 w-3" />,
                                desc: <IconSortDescending className="h-3 w-3" />,
                              }[header.column.getIsSorted() as string] ?? (
                                <IconSelector className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                              )
                            }
                          </div>
                        ) : null}
                      </div>
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
                  onClick={() => navigate(`/equipment/${row.original.id}`)}
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
                  No equipment found.
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
            const isIssued = Boolean(item.current_issuance)
            const { label, className } = getStatusBadge(item.status, isIssued)

            return (
              <div
                key={row.id}
                className="relative cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                onClick={() => navigate(`/equipment/${item.id}`)}
              >
                <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-lg bg-slate-900" />

                <div className="mb-3 flex items-start justify-between pl-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-100">
                      <IconPackage className="h-5 w-5 text-slate-600" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-semibold text-slate-900">{item.name}</h3>
                      <span className="text-xs text-slate-600">{item.serial_number || item.type}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("px-2 py-0.5 text-xs font-medium", className)}>
                    {label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Label</div>
                    <div className="text-sm font-semibold text-slate-700">{item.label || "-"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issued To</div>
                    <div className="text-sm font-semibold text-slate-900">{formatIssuedTo(item)}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-50 pt-3 pl-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected Return</div>
                    <div className="text-sm font-medium">{formatExpectedReturn(item)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next Update Due</div>
                    <div className="text-sm font-medium">{formatNextDue(item)}</div>
                  </div>
                </div>

                <div className="absolute bottom-4 right-4" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="outline" className="h-8 w-8 hover:bg-slate-100">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isIssued && onReturn ? (
                        <DropdownMenuItem onClick={() => onReturn?.(item)}>
                          <IconAlertCircle className="mr-2 h-4 w-4" /> Return
                        </DropdownMenuItem>
                      ) : onIssue ? (
                        <DropdownMenuItem onClick={() => onIssue?.(item)}>
                          <IconClock className="mr-2 h-4 w-4" /> Issue
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => onLogUpdate?.(item)}>
                        <IconPackage className="mr-2 h-4 w-4" /> Log Update
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate(`/equipment/${item.id}`)}>
                        <IconEdit className="mr-2 h-4 w-4" /> View Details
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
            No equipment found.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{start}</span> to{" "}
          <span className="font-semibold text-slate-900">{end}</span> of{" "}
          <span className="font-semibold text-slate-900">{total}</span> items
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
