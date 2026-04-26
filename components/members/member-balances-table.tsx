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
import { IconChevronDown, IconDownload, IconSearch, IconX } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { buildMemberBalancesCsv } from "@/lib/members/member-balances-csv"
import { balanceTabMatches, getBalanceCategory } from "@/lib/members/member-balance-utils"
import { getMemberDisplayName, getMembershipTypeLabel } from "@/lib/members/member-exports"
import type { MemberWithBalance, BalanceViewTab } from "@/lib/types/member-balances"
import type { MembershipStatus, PersonType } from "@/lib/types/members"
import { cn, getUserInitials } from "@/lib/utils"
import { formatDate } from "@/lib/utils/date-format"

import { MoreHorizontal } from "lucide-react"

type MembershipStatusFilter = "all" | MembershipStatus
type ActivityFilter = "all" | "active" | "inactive"

const BALANCE_TABS: { id: BalanceViewTab; label: string }[] = [
  { id: "debt", label: "In debt" },
  { id: "credit", label: "In credit" },
  { id: "balanced", label: "Balanced" },
  { id: "all", label: "All" },
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function formatDisplayBalance(balance: number) {
  const cat = getBalanceCategory(balance)
  if (cat === "credit") {
    return { text: `${Math.abs(balance).toFixed(2)} CR`, className: "text-emerald-700" }
  }
  if (cat === "debt") {
    return { text: `$${balance.toFixed(2)}`, className: "text-red-700" }
  }
  return { text: "$0.00", className: "text-slate-600" }
}

function personTypeLabel(p: PersonType): string {
  if (p === "staff") return "Staff"
  if (p === "instructor") return "Instructor"
  if (p === "member") return "Member"
  return "Contact"
}

type MemberBalancesTableProps = {
  sourceRows: MemberWithBalance[]
  timeZone: string
  isFetching: boolean
}

export function MemberBalancesTable({ sourceRows, timeZone, isFetching }: MemberBalancesTableProps) {
  const router = useRouter()

  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "balance", desc: true }])
  const [balanceTab, setBalanceTab] = React.useState<BalanceViewTab>("debt")
  const [personType, setPersonType] = React.useState<PersonType>("all")
  const [membershipStatus, setMembershipStatus] = React.useState<MembershipStatusFilter>("all")
  const [activity, setActivity] = React.useState<ActivityFilter>("all")
  const [membershipTypeId, setMembershipTypeId] = React.useState("all")
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false)
  const [isDownloadingCsv, setIsDownloadingCsv] = React.useState(false)
  const [isNavigating, startNav] = React.useTransition()

  const membershipTypeOptions = React.useMemo(() => {
    const options = new Map<string, { id: string; name: string }>()
    for (const m of sourceRows) {
      const t = m.membership?.membership_type
      if (!t?.id || !t.name) continue
      options.set(t.id, { id: t.id, name: t.name })
    }
    return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [sourceRows])

  const filteredByControls = React.useMemo(() => {
    const s = search.trim().toLowerCase()
    return sourceRows.filter((m) => {
      if (personType !== "all" && m.person_type !== personType) return false
      if (membershipStatus !== "all" && m.membership_status !== membershipStatus) return false
      if (membershipTypeId !== "all" && m.membership?.membership_type?.id !== membershipTypeId) {
        return false
      }
      if (activity === "active" && !m.is_active) return false
      if (activity === "inactive" && m.is_active) return false

      if (!s) return true
      const { firstName, lastName, email, name } = getMemberDisplayName(m)
      const full = `${firstName} ${lastName}`.trim().toLowerCase()
      const company = m.user?.company_name?.toLowerCase() ?? ""
      return (
        name.toLowerCase().includes(s) ||
        full.includes(s) ||
        email.toLowerCase().includes(s) ||
        company.includes(s) ||
        (m.user?.phone ?? "").toLowerCase().includes(s)
      )
    })
  }, [
    sourceRows,
    search,
    personType,
    membershipStatus,
    membershipTypeId,
    activity,
  ])

  const byBalanceTab = React.useMemo(
    () => filteredByControls.filter((m) => balanceTabMatches(balanceTab, m.current_balance)),
    [filteredByControls, balanceTab]
  )

  const columns = React.useMemo<ColumnDef<MemberWithBalance>[]>(
    () => [
      {
        id: "member",
        accessorFn: (row) => getMemberDisplayName(row).name,
        header: "Member",
        cell: ({ row }) => {
          const m = row.original
          const { firstName, lastName, email, name } = getMemberDisplayName(m)
          const initials = getUserInitials(firstName, lastName, email)
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 rounded-md">
                <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold text-slate-900">{name}</span>
                <span className="truncate text-xs text-slate-500">{email || "—"}</span>
              </div>
            </div>
          )
        },
      },
      {
        id: "type",
        accessorFn: (row) => personTypeLabel(row.person_type),
        header: "Type",
        cell: ({ row }) => (
          <span className="text-slate-700">{personTypeLabel(row.original.person_type)}</span>
        ),
      },
      {
        id: "membership",
        accessorFn: (row) => getMembershipTypeLabel(row),
        header: "Membership",
        cell: ({ row }) => (
          <span className="text-slate-700">{getMembershipTypeLabel(row.original) || "—"}</span>
        ),
      },
      {
        id: "balance",
        accessorFn: (row) => row.current_balance,
        header: () => <div className="text-right">Balance</div>,
        cell: ({ row }) => {
          const disp = formatDisplayBalance(row.original.current_balance)
          return <div className={cn("text-right font-mono text-sm font-semibold", disp.className)}>{disp.text}</div>
        },
      },
      {
        id: "status",
        accessorFn: (row) => getBalanceCategory(row.current_balance),
        header: "Status",
        cell: ({ row }) => {
          const cat = getBalanceCategory(row.original.current_balance)
          const label =
            cat === "debt" ? "In debt" : cat === "credit" ? "In credit" : "Balanced"
          const className =
            cat === "debt"
              ? "bg-red-50 text-red-800 border-red-200"
              : cat === "credit"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-slate-50 text-slate-700 border-slate-200"
          return (
            <Badge variant="outline" className={className}>
              {label}
            </Badge>
          )
        },
      },
      {
        id: "last_payment",
        accessorKey: "last_payment_at",
        header: "Last payment",
        cell: ({ row }) => {
          const t = row.original.last_payment_at
          return (
            <span className="text-sm text-slate-700">
              {t ? formatDate(t, timeZone, "short") : "—"}
            </span>
          )
        },
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const m = row.original
          return (
            <div className="text-right" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => startNav(() => router.push(`/members/${m.user_id}`))}
                  >
                    Open member
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      startNav(() => router.push(`/members/${m.user_id}?tab=finances`))
                    }
                  >
                    Open finances
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => startNav(() => router.push("/invoices"))}
                  >
                    Invoices
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [router, timeZone]
  )

  const table = useReactTable({
    data: byBalanceTab,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  const exportRows = table.getSortedRowModel().rows.map((r) => r.original)

  const handleCsv = React.useCallback(() => {
    if (exportRows.length === 0) return
    try {
      setIsDownloadingCsv(true)
      const csv = buildMemberBalancesCsv(exportRows)
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `member-balances-${stamp}.csv`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    } finally {
      setIsDownloadingCsv(false)
    }
  }, [exportRows])

  const hasActiveFilters =
    search.trim().length > 0 ||
    personType !== "all" ||
    membershipStatus !== "all" ||
    membershipTypeId !== "all" ||
    activity !== "all"
  const activeFilterCount = [
    personType !== "all",
    membershipStatus !== "all",
    membershipTypeId !== "all",
    activity !== "all",
  ].filter(Boolean).length

  const page = table.getState().pagination
  const total = byBalanceTab.length
  const rowCount = table.getRowModel().rows.length
  const start = rowCount === 0 ? 0 : page.pageIndex * page.pageSize + 1
  const end = Math.min((page.pageIndex + 1) * page.pageSize, total)
  const sortedRowCount = table.getSortedRowModel().rows.length

  const navigate = React.useCallback(
    (href: string) => {
      startNav(() => {
        router.push(href)
      })
    },
    [router]
  )

  return (
    <div className={cn("flex flex-col gap-6", (isNavigating || isFetching) && "cursor-progress")} aria-busy={isFetching}>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Member balances</h2>
          <p className="mt-1 text-slate-600">
            Current account balance per contact. Positive means amount owing; negative is credit on account.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <div className="relative w-full sm:w-auto">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search name, email, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full border-slate-200 bg-white pl-9 pr-9 focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900 sm:w-72"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <IconX className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200">
        {BALANCE_TABS.map((t) => {
          const active = balanceTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setBalanceTab(t.id)}
              className={cn(
                "border-b-2 px-4 py-2.5 text-sm font-semibold transition-all",
                active
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <Collapsible
        open={isFiltersOpen}
        onOpenChange={setIsFiltersOpen}
        className="rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 p-4 text-left"
            aria-label={isFiltersOpen ? "Collapse filters" : "Expand filters"}
          >
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-900">Filters</div>
              <p className="text-sm text-slate-600">
                {activeFilterCount > 0
                  ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied`
                  : "Filter by person type, membership, or portal access"}
              </p>
            </div>
            <IconChevronDown
              className={cn(
                "h-5 w-5 flex-shrink-0 text-slate-500 transition-transform",
                isFiltersOpen ? "rotate-180" : "rotate-0"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-slate-200 px-4 pb-4 pt-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
            <Select value={personType} onValueChange={(v) => setPersonType(v as PersonType)}>
              <SelectTrigger className="h-10 w-full border-slate-200 bg-white sm:w-[160px]">
                <SelectValue placeholder="Person type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All person types</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="instructor">Instructor</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="contact">Contact</SelectItem>
              </SelectContent>
            </Select>

            <Select value={membershipTypeId} onValueChange={setMembershipTypeId}>
              <SelectTrigger className="h-10 w-full border-slate-200 bg-white sm:w-[200px]">
                <SelectValue placeholder="Membership type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All membership types</SelectItem>
                {membershipTypeOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={membershipStatus}
              onValueChange={(v) => setMembershipStatus(v as MembershipStatusFilter)}
            >
              <SelectTrigger className="h-10 w-full border-slate-200 bg-white sm:w-[200px]">
                <SelectValue placeholder="Membership status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All membership statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="none">No membership</SelectItem>
              </SelectContent>
            </Select>

            <Select value={activity} onValueChange={(v) => setActivity(v as ActivityFilter)}>
              <SelectTrigger className="h-10 w-full border-slate-200 bg-white sm:w-[150px]">
                <SelectValue placeholder="Portal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All portal</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 justify-start px-3 text-slate-700 lg:ml-auto"
                onClick={() => {
                  setSearch("")
                  setPersonType("all")
                  setMembershipTypeId("all")
                  setMembershipStatus("all")
                  setActivity("all")
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{sortedRowCount}</span>{" "}
            matching current view
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-slate-900 text-white hover:bg-slate-800"
            disabled={exportRows.length === 0 || isDownloadingCsv}
            onClick={handleCsv}
          >
            <IconDownload className="mr-2 h-4 w-4" />
            {isDownloadingCsv ? "Preparing…" : "Export CSV"}
          </Button>
        </div>

        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr
                    key={headerGroup.id}
                    className="border-b border-slate-200 bg-slate-50/50"
                  >
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                        onClick={
                          header.column.getCanSort()
                            ? header.column.getToggleSortingHandler()
                            : undefined
                        }
                        style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? " ↑" : ""}
                        {header.column.getIsSorted() === "desc" ? " ↓" : ""}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="group cursor-pointer transition-colors hover:bg-slate-50/50"
                      onClick={() => navigate(`/members/${row.original.user_id}?tab=finances`)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3.5 align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="h-24 text-center font-medium text-slate-500">
                      No contacts match the current view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 p-3 md:hidden">
          {table.getRowModel().rows.length ? (
            <ul className="space-y-3">
              {table.getRowModel().rows.map((row) => {
                const m = row.original
                const { name, email } = getMemberDisplayName(m)
                const disp = formatDisplayBalance(m.current_balance)
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors active:bg-slate-50"
                      onClick={() => navigate(`/members/${m.user_id}?tab=finances`)}
                    >
                      <div className="font-semibold text-slate-900">{name}</div>
                      <div className="text-xs text-slate-500">{email}</div>
                      <div className={cn("mt-2 font-mono text-sm font-semibold", disp.className)}>
                        {disp.text}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-12 text-center font-medium text-slate-500">
              No contacts match the current view.
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{start}</span> to{" "}
          <span className="font-semibold text-slate-900">{end}</span> of{" "}
          <span className="font-semibold text-slate-900">{total}</span> contacts
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
