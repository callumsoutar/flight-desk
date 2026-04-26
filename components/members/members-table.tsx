"use client"

import type { DocumentProps } from "@react-pdf/renderer"
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
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
  IconCircleX,
  IconDownload,
  IconSearch,
  IconShield,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { MembersExportPDF } from "@/components/members/members-export-pdf"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { useAuth } from "@/contexts/auth-context"
import {
  buildMemberExportRows,
  buildMembersCsv,
  getMemberDisplayName,
  getMembershipStatusLabel,
  getMembershipTypeLabel,
} from "@/lib/members/member-exports"
import type { MemberWithRelations, PersonType } from "@/lib/types/members"
import { cn, getUserInitials } from "@/lib/utils"

interface MembersTableProps {
  members: MemberWithRelations[]
  activeTab: PersonType
  onTabChange: (tab: PersonType) => void
  onAdd?: () => void
  tabCounts: {
    all: number
    member: number
    instructor: number
    staff: number
    contact: number
  }
}

type MembershipStatusFilterValue = "all" | "active" | "expired" | "none"
type MemberActivityFilterValue = "all" | "active" | "inactive"

function getPersonTypeLabel(member: MemberWithRelations): string {
  if (member.person_type === "staff") return "Staff"
  if (member.person_type === "instructor") return "Instructor"
  if (member.person_type === "member") return "Member"
  return "Contact"
}

function getAccessBadge(isActive: boolean): { label: string; className: string } {
  if (isActive) {
    return { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  }

  return { label: "Inactive", className: "bg-red-50 text-red-700 border-red-200" }
}

function getMembershipStatusBadge(status: MembershipStatusFilterValue): {
  label: string
  className: string
} {
  if (status === "active") {
    return { label: "Active", className: "bg-blue-50 text-blue-700 border-blue-200" }
  }
  if (status === "expired") {
    return { label: "Expired", className: "bg-amber-50 text-amber-700 border-amber-200" }
  }
  return { label: "No membership", className: "bg-slate-50 text-slate-600 border-slate-200" }
}

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

export function MembersTable({
  members,
  activeTab,
  onTabChange,
  onAdd,
  tabCounts,
}: MembersTableProps) {
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})
  const [isSelectionMode, setIsSelectionMode] = React.useState(false)
  const [membershipStatusFilter, setMembershipStatusFilter] =
    React.useState<MembershipStatusFilterValue>("all")
  const [membershipTypeFilter, setMembershipTypeFilter] = React.useState("all")
  const [activityFilter, setActivityFilter] = React.useState<MemberActivityFilterValue>("all")
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false)
  const [isDownloadingCsv, setIsDownloadingCsv] = React.useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false)
  const [isNavigating, startNavigation] = React.useTransition()
  const router = useRouter()
  const { role } = useAuth()

  const navigate = React.useCallback(
    (href: string) => {
      startNavigation(() => {
        router.push(href)
      })
    },
    [router]
  )

  const membershipTypeOptions = React.useMemo(
    () => {
      const options = new Map<string, { id: string; name: string }>()

      for (const member of members) {
        const type = member.membership?.membership_type
        if (!type?.id || !type.name) continue
        options.set(type.id, { id: type.id, name: type.name })
      }

      return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name))
    },
    [members]
  )

  const filteredMembers = React.useMemo(() => {
    const searchLower = search.trim().toLowerCase()

    return members.filter((member) => {
      if (membershipStatusFilter !== "all" && member.membership_status !== membershipStatusFilter) {
        return false
      }

      if (
        membershipTypeFilter !== "all" &&
        member.membership?.membership_type?.id !== membershipTypeFilter
      ) {
        return false
      }

      if (activityFilter === "active" && !member.is_active) return false
      if (activityFilter === "inactive" && member.is_active) return false

      if (!searchLower) return true

      const { firstName, lastName, email } = getMemberDisplayName(member)
      const fullName = `${firstName} ${lastName}`.trim().toLowerCase()
      const phone = member.user?.phone?.toLowerCase() ?? ""
      const companyName = member.user?.company_name?.toLowerCase() ?? ""
      const roleName = (member.role?.name ?? "").toLowerCase()
      const personType = getPersonTypeLabel(member).toLowerCase()
      const membershipType = getMembershipTypeLabel(member).toLowerCase()
      const membershipStatus = getMembershipStatusLabel(member.membership_status).toLowerCase()

      return (
        firstName.toLowerCase().includes(searchLower) ||
        lastName.toLowerCase().includes(searchLower) ||
        email.toLowerCase().includes(searchLower) ||
        fullName.includes(searchLower) ||
        phone.includes(searchLower) ||
        companyName.includes(searchLower) ||
        roleName.includes(searchLower) ||
        personType.includes(searchLower) ||
        membershipType.includes(searchLower) ||
        membershipStatus.includes(searchLower)
      )
    })
  }, [activityFilter, members, membershipStatusFilter, membershipTypeFilter, search])

  const columns = React.useMemo<ColumnDef<MemberWithRelations>[]>(
    () => {
      const baseColumns: ColumnDef<MemberWithRelations>[] = [
        {
        id: "member",
        accessorFn: (row) => getMemberDisplayName(row).name,
        header: "Member",
        cell: ({ row }) => {
          const member = row.original
          const { firstName, lastName, email, name } = getMemberDisplayName(member)
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
                <span className="truncate text-xs text-slate-600">{email || "-"}</span>
              </div>
            </div>
          )
        },
      },
      {
        id: "company",
        accessorFn: (row) => row.user?.company_name ?? "",
        header: "Company",
        cell: ({ row }) => (
          <span className="text-slate-700">{row.original.user?.company_name?.trim() || "-"}</span>
        ),
      },
      {
        id: "membership_type",
        accessorFn: (row) => getMembershipTypeLabel(row),
        header: "Membership",
        cell: ({ row }) => (
          <span className="text-slate-700">{getMembershipTypeLabel(row.original) || "-"}</span>
        ),
      },
      {
        id: "membership_status",
        accessorFn: (row) => row.membership_status,
        header: () => <div className="text-center">Membership Status</div>,
        cell: ({ row }) => {
          const { label, className } = getMembershipStatusBadge(row.original.membership_status)

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
        id: "role",
        accessorFn: (row) => getPersonTypeLabel(row),
        header: "Role",
        cell: ({ row }) => {
          const roleLabel = getPersonTypeLabel(row.original)

          return (
            <Badge
              variant="outline"
              className="border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700"
            >
              {roleLabel}
            </Badge>
          )
        },
      },
      {
        id: "status",
        accessorFn: (row) => (row.is_active ? "active" : "inactive"),
        header: () => <div className="text-center">Access</div>,
        cell: ({ row }) => {
          const { label, className } = getAccessBadge(row.original.is_active)

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
        id: "actions",
        cell: () => (
          <div className="flex justify-end">
            {!isSelectionMode ? <IconChevronRight className="h-4 w-4 text-slate-300" /> : null}
          </div>
        ),
        enableSorting: false,
      },
      ]

      if (!isSelectionMode) return baseColumns

      return [
        {
          id: "select",
          header: ({ table }) => (
            <div className="flex items-center justify-center">
              <Checkbox
                checked={
                  table.getIsAllPageRowsSelected() ||
                  (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
              />
            </div>
          ),
          cell: ({ row }) => (
            <div
              className="flex items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select member"
              />
            </div>
          ),
          enableSorting: false,
          enableHiding: false,
        },
        ...baseColumns,
      ]
    },
    [isSelectionMode]
  )

  const table = useReactTable<MemberWithRelations>({
    data: filteredMembers,
    columns,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.user_id,
    state: { sorting, rowSelection },
    enableRowSelection: true,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
  })

  React.useEffect(() => {
    setRowSelection({})
  }, [activeTab, activityFilter, membershipStatusFilter, membershipTypeFilter, search])

  const openSelectionMode = React.useCallback(() => {
    setIsSelectionMode(true)
  }, [])

  const closeSelectionMode = React.useCallback(() => {
    setIsSelectionMode(false)
    setRowSelection({})
  }, [])

  const canAddMember = role ? !["member", "student"].includes(role.toLowerCase()) : false
  const tabs = [
    { id: "member" as PersonType, label: "Members" },
    { id: "instructor" as PersonType, label: "Instructors" },
    { id: "staff" as PersonType, label: "Staff" },
    { id: "all" as PersonType, label: "All Contacts" },
  ]

  const page = table.getState().pagination
  const total = filteredMembers.length
  const rowCount = table.getRowModel().rows.length
  const start = rowCount === 0 ? 0 : page.pageIndex * page.pageSize + 1
  const end = Math.min((page.pageIndex + 1) * page.pageSize, total)
  const selectedMembers = table.getSelectedRowModel().rows.map((row) => row.original)
  const sortedMembers = table.getSortedRowModel().rows.map((row) => row.original)
  const exportMembers = selectedMembers.length ? selectedMembers : sortedMembers
  const hasActiveFilters =
    search.trim().length > 0 ||
    membershipStatusFilter !== "all" ||
    membershipTypeFilter !== "all" ||
    activityFilter !== "all"
  const activeFilterCount = [
    membershipStatusFilter !== "all",
    membershipTypeFilter !== "all",
    activityFilter !== "all",
  ].filter(Boolean).length

  const buildExportFileName = React.useCallback(
    (extension: "csv" | "pdf") => {
      const dateStamp = new Date().toISOString().slice(0, 10)
      const scope = selectedMembers.length
        ? "selected"
        : hasActiveFilters || activeTab !== "member"
          ? "filtered"
          : "all"
      return `members-${scope}-${dateStamp}.${extension}`
    },
    [activeTab, hasActiveFilters, selectedMembers.length]
  )

  const handleDownloadCsv = React.useCallback(() => {
    if (exportMembers.length === 0) return

    try {
      setIsDownloadingCsv(true)
      const csv = buildMembersCsv(exportMembers)
      downloadBlob(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        buildExportFileName("csv")
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download CSV")
    } finally {
      setIsDownloadingCsv(false)
    }
  }, [buildExportFileName, exportMembers])

  const handleDownloadPdf = React.useCallback(async () => {
    if (exportMembers.length === 0) return

    try {
      setIsDownloadingPdf(true)
      const generatedAt = new Intl.DateTimeFormat("en-NZ", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date())
      const rows = buildMemberExportRows(exportMembers)
      const { pdf } = await import("@react-pdf/renderer")
      const blob = await pdf(
        (
          <MembersExportPDF
            rows={rows}
            generatedAt={generatedAt}
          />
        ) as unknown as React.ReactElement<DocumentProps>
      ).toBlob()

      downloadBlob(blob, buildExportFileName("pdf"))
    } catch (error) {
      console.error("[members PDF] download failed", error)
      toast.error(error instanceof Error ? error.message : "Failed to download PDF")
    } finally {
      setIsDownloadingPdf(false)
    }
  }, [buildExportFileName, exportMembers])

  return (
    <div className={cn("flex flex-col gap-6", isNavigating && "cursor-progress")} aria-busy={isNavigating}>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Members</h2>
          <p className="mt-1 text-slate-600">Manage your organization&apos;s members and their roles.</p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <div className="relative w-full sm:w-auto">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search members..."
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

          {canAddMember ? (
            <Button
              className="h-10 w-full bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800 sm:w-auto"
              onClick={() => {
                if (onAdd) {
                  onAdd()
                  return
                }
                navigate("/members/new")
              }}
            >
              <IconUserPlus className="mr-2 h-4 w-4" />
              New Member
            </Button>
          ) : null}
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
                "border-b-2 px-4 py-2.5 text-sm font-semibold transition-all",
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              )}
            >
              {tab.label} ({count})
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
                  : "Filter by membership status, membership type, or access"}
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Select
              value={membershipStatusFilter}
              onValueChange={(value) => setMembershipStatusFilter(value as MembershipStatusFilterValue)}
            >
              <SelectTrigger className="h-10 w-full border-slate-200 bg-white sm:w-[180px]">
                <SelectValue placeholder="Membership status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All membership statuses</SelectItem>
                <SelectItem value="active">Active membership</SelectItem>
                <SelectItem value="expired">Expired membership</SelectItem>
                <SelectItem value="none">No membership</SelectItem>
              </SelectContent>
            </Select>

            <Select value={membershipTypeFilter} onValueChange={setMembershipTypeFilter}>
              <SelectTrigger className="h-10 w-full border-slate-200 bg-white sm:w-[200px]">
                <SelectValue placeholder="Membership type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All membership types</SelectItem>
                {membershipTypeOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={activityFilter}
              onValueChange={(value) => setActivityFilter(value as MemberActivityFilterValue)}
            >
              <SelectTrigger className="h-10 w-full border-slate-200 bg-white sm:w-[150px]">
                <SelectValue placeholder="Access" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All access</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 justify-start px-3 text-slate-700 lg:ml-auto"
                onClick={() => {
                  setSearch("")
                  setMembershipStatusFilter("all")
                  setMembershipTypeFilter("all")
                  setActivityFilter("all")
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
            {isSelectionMode ? (
              selectedMembers.length ? (
                <>
                  <span className="font-semibold text-slate-900">{selectedMembers.length}</span> selected
                </>
              ) : (
                "Selection mode on. Choose members from the table."
              )
            ) : (
              <>
                <span className="font-semibold text-slate-900">{sortedMembers.length}</span> matching current view
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isSelectionMode ? (
              <Button type="button" variant="outline" size="sm" onClick={closeSelectionMode}>
                Done
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={openSelectionMode}>
                Select
              </Button>
            )}

            {isSelectionMode && selectedMembers.length ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setRowSelection({})}>
                Clear selection
              </Button>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className="bg-slate-900 text-white hover:bg-slate-800"
                  disabled={exportMembers.length === 0 || isDownloadingCsv || isDownloadingPdf}
                >
                  <IconDownload className="mr-2 h-4 w-4" />
                  {isDownloadingCsv || isDownloadingPdf ? "Preparing..." : "Export"}
                  <IconChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  disabled={exportMembers.length === 0 || isDownloadingCsv || isDownloadingPdf}
                  onSelect={(event) => {
                    event.preventDefault()
                    handleDownloadCsv()
                  }}
                >
                  {selectedMembers.length ? "Download selected as CSV" : "Download current view as CSV"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={exportMembers.length === 0 || isDownloadingPdf || isDownloadingCsv}
                  onSelect={(event) => {
                    event.preventDefault()
                    void handleDownloadPdf()
                  }}
                >
                  {selectedMembers.length ? "Download selected as PDF" : "Download current view as PDF"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="hidden md:block">
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
                        header.id === "membership_status" || header.id === "status"
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
                  className={cn(
                    "group cursor-pointer transition-colors hover:bg-slate-50/50",
                    row.getIsSelected() && "bg-slate-50"
                  )}
                  onClick={() => {
                    if (isSelectionMode) {
                      row.toggleSelected(!row.getIsSelected())
                      return
                    }
                    navigate(`/members/${row.original.user_id}`)
                  }}
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
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>

        <div className="space-y-3 p-3 md:hidden">
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => {
              const member = row.original
              const { firstName, lastName, email, name } = getMemberDisplayName(member)
              const initials = getUserInitials(firstName, lastName, email)
              const accessBadge = getAccessBadge(member.is_active)
              const membershipBadge = getMembershipStatusBadge(member.membership_status)
              const roleLabel = getPersonTypeLabel(member)

              return (
                <div
                  key={row.id}
                  className={cn(
                    "relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50",
                    row.getIsSelected() && "border-slate-300 bg-slate-50"
                  )}
                  onClick={() => {
                    if (isSelectionMode) {
                      row.toggleSelected(!row.getIsSelected())
                      return
                    }
                    navigate(`/members/${member.user_id}`)
                  }}
                >
                  <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-lg bg-slate-900" />

                  <div className="mb-3 flex items-start justify-between gap-3 pl-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-10 w-10 rounded-md">
                        <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <h3 className="truncate font-semibold text-slate-900">{name}</h3>
                        <span className="truncate text-xs text-slate-600">{email || "-"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSelectionMode ? (
                        <div onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={row.getIsSelected()}
                            onCheckedChange={(value) => row.toggleSelected(!!value)}
                            aria-label="Select member"
                          />
                        </div>
                      ) : null}
                      <Badge
                        variant="outline"
                        className={cn("px-2 py-0.5 text-xs font-medium", accessBadge.className)}
                      >
                        {accessBadge.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pl-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <IconShield className="h-3 w-3" /> Role
                      </div>
                      <div className="text-sm font-semibold text-slate-700">{roleLabel}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Membership
                      </div>
                      <div className="text-sm font-semibold text-slate-700">
                        {getMembershipTypeLabel(member) || "-"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Membership status
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("px-2 py-0.5 text-xs font-medium", membershipBadge.className)}
                      >
                        {membershipBadge.label}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {member.is_active ? (
                          <IconCircleCheck className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <IconCircleX className="h-3 w-3 text-red-600" />
                        )}
                        Access
                      </div>
                      <div
                        className={cn(
                          "text-sm font-semibold",
                          member.is_active ? "text-emerald-700" : "text-red-700"
                        )}
                      >
                        {member.is_active ? "Active" : "Inactive"}
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
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-12 text-center font-medium text-slate-500">
              No members found.
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{start}</span> to{" "}
          <span className="font-semibold text-slate-900">{end}</span> of{" "}
          <span className="font-semibold text-slate-900">{total}</span> members
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
