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
  IconUserPlus,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/contexts/auth-context"
import { cn, getUserInitials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { MemberWithRelations, PersonType } from "@/lib/types/members"

interface MembersTableProps {
  members: MemberWithRelations[]
  activeTab: PersonType
  onTabChange: (tab: PersonType) => void
  tabCounts: {
    all: number
    member: number
    instructor: number
    staff: number
    contact: number
  }
}

function getPersonTypeLabel(member: MemberWithRelations): string {
  if (member.person_type === "staff") return "Staff"
  if (member.person_type === "instructor") return "Instructor"
  if (member.person_type === "member") return "Member"
  return "Contact"
}

function getStatusBadge(isActive: boolean): { label: string; className: string } {
  if (isActive) {
    return { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  }

  return { label: "Inactive", className: "bg-red-50 text-red-700 border-red-200" }
}

function getDisplayName(member: MemberWithRelations) {
  const firstName = member.user?.first_name ?? ""
  const lastName = member.user?.last_name ?? ""
  const email = member.user?.email ?? ""
  const name = [firstName, lastName].filter(Boolean).join(" ")

  return {
    firstName,
    lastName,
    email,
    name: name || email || "Unknown",
  }
}

export function MembersTable({
  members,
  activeTab,
  onTabChange,
  tabCounts,
}: MembersTableProps) {
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const router = useRouter()
  const { role } = useAuth()

  const filteredMembers = React.useMemo(() => {
    if (!search) return members

    const searchLower = search.toLowerCase()

    return members.filter((member) => {
      const { firstName, lastName, email } = getDisplayName(member)
      const fullName = `${firstName} ${lastName}`.trim().toLowerCase()

      return (
        firstName.toLowerCase().includes(searchLower) ||
        lastName.toLowerCase().includes(searchLower) ||
        email.toLowerCase().includes(searchLower) ||
        fullName.includes(searchLower)
      )
    })
  }, [members, search])

  const columns = React.useMemo<ColumnDef<MemberWithRelations>[]>(
    () => [
      {
        id: "member",
        header: "Member",
        cell: ({ row }) => {
          const member = row.original
          const { firstName, lastName, email, name } = getDisplayName(member)
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
        id: "role",
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
        header: () => <div className="text-center">Status</div>,
        cell: ({ row }) => {
          const { label, className } = getStatusBadge(row.original.is_active)

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
            <IconChevronRight className="h-4 w-4 text-slate-300" />
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable<MemberWithRelations>({
    data: filteredMembers,
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

  const canAddMember = role ? !["member", "student"].includes(role.toLowerCase()) : false

  const tabs = [
    { id: "member" as PersonType, label: "Members" },
    { id: "instructor" as PersonType, label: "Instructors" },
    { id: "staff" as PersonType, label: "Staff" },
    { id: "all" as PersonType, label: "All Contacts" },
  ]

  const page = table.getState().pagination
  const total = filteredMembers.length
  const start = total === 0 ? 0 : page.pageIndex * page.pageSize + 1
  const end = Math.min((page.pageIndex + 1) * page.pageSize, total)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Members</h2>
          <p className="mt-1 text-slate-600">Manage your organization&apos;s members and their roles.</p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <div className="relative w-full sm:w-auto">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full border-slate-200 bg-white pl-9 focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900 sm:w-64"
            />
          </div>

          {canAddMember ? (
            <Button
              className="h-10 w-full bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800 sm:w-auto"
              onClick={() => router.push("/members/new")}
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
                        header.id === "status" ? "text-center" : "text-left"
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
                  onClick={() => router.push(`/members/${row.original.user_id}`)}
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

      <div className="space-y-3 md:hidden">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const member = row.original
            const { firstName, lastName, email, name } = getDisplayName(member)
            const initials = getUserInitials(firstName, lastName, email)
            const { label: statusLabel, className: statusClass } = getStatusBadge(member.is_active)
            const roleLabel = getPersonTypeLabel(member)

            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
                onClick={() => router.push(`/members/${member.user_id}`)}
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
                      <IconShield className="h-3 w-3" /> Role
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{roleLabel}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {member.is_active ? (
                        <IconCircleCheck className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <IconCircleX className="h-3 w-3 text-red-600" />
                      )}
                      Status
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
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
            No members found.
          </div>
        )}
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
