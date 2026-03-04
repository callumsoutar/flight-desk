"use client"

import * as React from "react"
import {
  IconAlertTriangle,
  IconChecks,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconFlame,
  IconInfoCircle,
  IconSchool,
  IconSearch,
} from "@tabler/icons-react"

import { TrainingStudentSheet } from "@/components/training/training-student-sheet"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn, getUserInitials } from "@/lib/utils"
import type {
  TrainingOverviewResponse,
  TrainingOverviewRow,
  TrainingOverviewView,
} from "@/lib/types/training-overview"

type SortKey = "name" | "syllabus" | "enrolled" | "last_flight" | "progress" | "status"

const DATE_FORMATTER = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

function safeFormatDate(value: string | null | undefined) {
  if (!value) return "-"
  try {
    return DATE_FORMATTER.format(new Date(value))
  } catch {
    return "-"
  }
}

function daysAgoLabel(days: number | null, fallback: string) {
  if (days === null) return fallback
  if (days === 0) return "today"
  if (days === 1) return "1 day ago"
  return `${days} days ago`
}

function matchesSearch(row: TrainingOverviewRow, search: string) {
  const s = search.toLowerCase()
  const fn = row.student.first_name?.toLowerCase() || ""
  const ln = row.student.last_name?.toLowerCase() || ""
  const email = row.student.email?.toLowerCase() || ""
  const full = `${fn} ${ln}`.trim()
  const syllabus = row.syllabus.name.toLowerCase()
  return fn.includes(s) || ln.includes(s) || email.includes(s) || full.includes(s) || syllabus.includes(s)
}

function viewIncludes(view: TrainingOverviewView, status: TrainingOverviewRow["activity_status"]) {
  if (view === "all") return true
  if (view === "active") return status === "active"
  if (view === "stale") return status === "stale"
  return status === "at_risk" || status === "new"
}

function statusBadge(status: TrainingOverviewRow["activity_status"]) {
  if (status === "active") {
    return { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200/50" }
  }
  if (status === "stale") {
    return { label: "Stale", className: "bg-rose-50 text-rose-700 border-rose-200/50" }
  }
  if (status === "new") {
    return { label: "New", className: "bg-blue-50 text-blue-700 border-blue-200/50" }
  }
  return { label: "At risk", className: "bg-amber-50 text-amber-700 border-amber-200/50" }
}

function progressBar(percent: number | null) {
  const pct = percent ?? 0
  return (
    <div className="w-full">
      <div className="h-1.5 rounded-full bg-slate-100/80 overflow-hidden">
        <div
          className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  )
}

function fullName(row: TrainingOverviewRow) {
  const first = row.student.first_name ?? ""
  const last = row.student.last_name ?? ""
  const name = `${first} ${last}`.trim()
  return name.length ? name : row.student.email ?? "Student"
}

function rowAccent(row: TrainingOverviewRow) {
  if (row.activity_status === "stale") return "border-l-rose-500"
  if (row.activity_status === "at_risk") return "border-l-amber-500"
  if (row.activity_status === "new") return "border-l-blue-500"
  return "border-l-emerald-500"
}

function SortHeader({
  label,
  sortKeyVal,
  className,
  onSort,
}: {
  label: string
  sortKeyVal: SortKey
  className?: string
  onSort: (key: SortKey) => void
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none",
        className
      )}
      onClick={() => onSort(sortKeyVal)}
    >
      <span className="inline-flex items-center gap-1">{label}</span>
    </th>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  description,
  icon: Icon,
  iconColor,
}: {
  label: string
  value: number
  sub: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex items-center gap-1.5">
          <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {label}
          </CardDescription>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="outline-hidden">
                <IconInfoCircle className="h-3 w-3 text-slate-300 hover:text-slate-400 transition-colors" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-[11px] font-medium leading-tight bg-slate-900 text-white border-slate-800 shadow-xl rounded-lg px-3 py-2">
              {description}
            </TooltipContent>
          </Tooltip>
        </div>
        <CardTitle className="text-3xl font-semibold tabular-nums @[250px]/card:text-4xl">
          {value}
        </CardTitle>
        <div className="ml-auto -mt-8">
          <Badge
            variant="outline"
            className="h-8 w-8 justify-center p-0 text-slate-700"
            aria-label={label}
          >
            <Icon className={cn("h-4 w-4", iconColor)} />
          </Badge>
        </div>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">{sub}</div>
      </CardFooter>
    </Card>
  )
}

export function TrainingPageClient({ data }: { data: TrainingOverviewResponse }) {
  const [view, setView] = React.useState<TrainingOverviewView>("all")
  const [syllabusId, setSyllabusId] = React.useState<string>("all")
  const [search, setSearch] = React.useState("")
  const [sortKey, setSortKey] = React.useState<SortKey>("name")
  const [sortAsc, setSortAsc] = React.useState(true)
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set())

  const [selectedRow, setSelectedRow] = React.useState<TrainingOverviewRow | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const statsFromRows = React.useMemo(() => {
    const rows = data.rows
    const active = rows.filter((r) => r.activity_status === "active").length
    const stale = rows.filter((r) => r.activity_status === "stale").length
    const atRisk = rows.filter((r) => r.activity_status === "at_risk").length
    const newlyEnrolled = rows.filter((r) => r.activity_status === "new").length
    const neverFlown = rows.filter((r) => !r.last_flight_at).length
    return { active, stale, atRisk, newlyEnrolled, neverFlown, total: rows.length }
  }, [data.rows])

  const viewTabCounts = React.useMemo(() => {
    return {
      at_risk: statsFromRows.atRisk + statsFromRows.newlyEnrolled,
      active: statsFromRows.active,
      stale: statsFromRows.stale,
      all: statsFromRows.total,
    } satisfies Record<TrainingOverviewView, number>
  }, [statsFromRows])

  const filteredRows = React.useMemo(() => {
    let rows = data.rows

    if (syllabusId !== "all") rows = rows.filter((r) => r.syllabus_id === syllabusId)
    if (search.trim()) rows = rows.filter((r) => matchesSearch(r, search.trim()))

    rows = rows.filter((r) => viewIncludes(view, r.activity_status))

    const sorted = [...rows]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "name":
          cmp = fullName(a).localeCompare(fullName(b))
          break
        case "syllabus":
          cmp = a.syllabus.name.localeCompare(b.syllabus.name)
          break
        case "enrolled":
          cmp = a.enrolled_at.localeCompare(b.enrolled_at)
          break
        case "last_flight":
          cmp = (a.last_flight_at ?? "").localeCompare(b.last_flight_at ?? "")
          break
        case "progress":
          cmp = (a.progress.percent ?? -1) - (b.progress.percent ?? -1)
          break
        case "status":
          cmp = a.activity_status.localeCompare(b.activity_status)
          break
      }
      return sortAsc ? cmp : -cmp
    })
    return sorted
  }, [data.rows, search, sortAsc, sortKey, syllabusId, view])

  React.useEffect(() => {
    setCollapsedGroups(new Set())
  }, [syllabusId, view, search])

  const groupedRows = React.useMemo(() => {
    if (syllabusId !== "all") return null
    const map = new Map<string, TrainingOverviewRow[]>()
    for (const r of filteredRows) {
      const key = r.syllabus.name
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filteredRows, syllabusId])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const openStudent = (row: TrainingOverviewRow) => {
    setSelectedRow(row)
    setSheetOpen(true)
  }

  const renderRow = (row: TrainingOverviewRow) => {
    const name = fullName(row)
    const initials = getUserInitials(row.student.first_name, row.student.last_name, row.student.email)
    const badge = statusBadge(row.activity_status)

    return (
      <tr
        key={row.enrollment_id}
        onClick={() => openStudent(row)}
        className={cn(
          "border-l-[3px] cursor-pointer transition-all border-b border-border/50 group",
          rowAccent(row),
          selectedRow?.enrollment_id === row.enrollment_id ? "bg-accent/60" : "hover:bg-muted/50"
        )}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar className="h-10 w-10 rounded-full border border-slate-200/50 shadow-sm ring-2 ring-white">
              <AvatarFallback className="bg-slate-100 text-slate-500 text-[11px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 gap-0.5">
              <span className="font-bold text-slate-900 truncate leading-none">{name}</span>
              <span className="text-[12px] text-slate-500 font-medium truncate leading-none">
                {row.student.email ?? ""}
              </span>
            </div>
          </div>
        </td>

        {syllabusId === "all" ? null : (
          <td className="px-4 py-3">
            <Badge
              variant="outline"
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-none border border-slate-200 bg-slate-50/50 text-slate-600 uppercase tracking-wider"
            >
              {row.syllabus.name}
            </Badge>
          </td>
        )}

        <td className="px-4 py-3">
          <div className="text-[13px] text-slate-600 font-medium tracking-tight">
            {safeFormatDate(row.enrolled_at)}
          </div>
        </td>

        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-bold text-slate-900 tracking-tight">
              {row.last_flight_at ? safeFormatDate(row.last_flight_at) : "Never"}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              {row.last_flight_at
                ? daysAgoLabel(row.days_since_last_flight, "")
                : `${row.days_since_enrolled} days since enrolled`}
            </span>
          </div>
        </td>

        <td className="px-4 py-3">
          <div className="min-w-[160px] flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-700">
                {row.progress.total > 0 ? `${row.progress.completed} / ${row.progress.total} lessons` : "—"}
              </span>
              {row.progress.percent !== null ? (
                <span className="text-[10px] font-bold text-slate-400">{row.progress.percent}%</span>
              ) : null}
            </div>
            {progressBar(row.progress.percent)}
          </div>
        </td>

        <td className="px-4 py-3">
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-none border uppercase tracking-wider",
                badge.className
              )}
            >
              {badge.label}
            </Badge>
          </div>
        </td>

        <td className="px-4 py-3">
          <div className="flex justify-end pr-2">
            <IconChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
          </div>
        </td>
      </tr>
    )
  }

  const viewTabs: Array<{ id: TrainingOverviewView; label: string; icon: React.ComponentType<{ className?: string }> }> =
    [
      { id: "all", label: "All", icon: IconSchool },
      { id: "at_risk", label: "At-risk", icon: IconAlertTriangle },
      { id: "active", label: "Active", icon: IconChecks },
      { id: "stale", label: "Stale", icon: IconFlame },
    ]

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Training</h2>
        <p className="text-[14px] text-slate-500 max-w-3xl">
          A high-level view of student syllabus enrollments, grouped by syllabus.
        </p>
      </div>

      <TooltipProvider delayDuration={0}>
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryCard
            label="At-risk"
            value={statsFromRows.atRisk + statsFromRows.newlyEnrolled}
            sub={`Includes ${statsFromRows.newlyEnrolled} new`}
            description="No flight in 31–60 days, or newly enrolled students (≤30d) yet to fly."
            icon={IconAlertTriangle}
            iconColor="text-amber-500"
          />
          <SummaryCard
            label="Stale"
            value={statsFromRows.stale}
            sub="Long time since last flight"
            description="No flight in 60+ days, or enrolled (30d+) yet to fly."
            icon={IconFlame}
            iconColor="text-rose-500"
          />
          <SummaryCard
            label="Active"
            value={statsFromRows.active}
            sub="Flew recently"
            description="Student has completed a recorded flight within the last 30 days."
            icon={IconChecks}
            iconColor="text-emerald-500"
          />
          <SummaryCard
            label="Never flown"
            value={statsFromRows.neverFlown}
            sub="No recorded flight"
            description="Students who have no recorded flight activity in the system for this syllabus."
            icon={IconClock}
            iconColor="text-indigo-500"
          />
          <SummaryCard
            label="Enrolled"
            value={statsFromRows.total}
            sub="Active enrollments"
            description="Total number of syllabus enrollments visible to you."
            icon={IconSchool}
            iconColor="text-slate-500"
          />
        </div>
      </TooltipProvider>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
            {viewTabs.map((t) => {
              const Icon = t.icon
              const isActive = view === t.id
              const count = viewTabCounts[t.id]
              return (
                <button
                  key={t.id}
                  onClick={() => setView(t.id)}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all",
                    isActive
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-slate-900" : "text-slate-400")} />
                  {t.label}
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

          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <div className="w-full sm:w-64">
              <Select value={syllabusId} onValueChange={setSyllabusId}>
                <SelectTrigger className="w-full h-9 rounded-xl border-slate-200/70 bg-white shadow-sm hover:border-slate-300 transition-colors text-[13px] font-medium px-3">
                  <div className="flex items-center gap-2.5">
                    <IconSchool className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <SelectValue placeholder="All syllabi" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-lg min-w-[var(--radix-select-trigger-width)]" position="popper" align="start">
                  <SelectItem value="all" className="text-[13px] py-2">All syllabi</SelectItem>
                  {data.syllabi.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-[13px] py-2">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative w-full sm:w-64">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full h-9 rounded-xl border-slate-200/70 bg-white shadow-sm focus:ring-slate-100 hover:border-slate-300 transition-colors text-[13px]"
              />
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {filteredRows.length} student{filteredRows.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="overflow-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-100 bg-slate-50/70 backdrop-blur">
                <SortHeader label="Student" sortKeyVal="name" onSort={toggleSort} />
                {syllabusId === "all" ? null : (
                  <SortHeader label="Syllabus" sortKeyVal="syllabus" onSort={toggleSort} />
                )}
                <SortHeader label="Enrolled" sortKeyVal="enrolled" onSort={toggleSort} />
                <SortHeader label="Last flew" sortKeyVal="last_flight" onSort={toggleSort} />
                <SortHeader label="Progress" sortKeyVal="progress" onSort={toggleSort} />
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => toggleSort("status")}>
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {groupedRows ? (
                groupedRows.map(([groupKey, groupStudents]) => {
                  const isCollapsed = collapsedGroups.has(groupKey)
                  return (
                    <React.Fragment key={groupKey}>
                      <tr
                        className="bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => toggleGroup(groupKey)}
                      >
                        <td colSpan={7} className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm font-semibold">{groupKey}</span>
                            <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
                              {groupStudents.length}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {!isCollapsed ? groupStudents.map(renderRow) : null}
                    </React.Fragment>
                  )
                })
              ) : filteredRows.length ? (
                filteredRows.map(renderRow)
              ) : (
                <tr>
                  <td colSpan={7} className="h-32 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center gap-1">
                      <span>No students match these filters.</span>
                      <span className="text-[11px]">Try adjusting your search or filters.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TrainingStudentSheet
        row={selectedRow}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setSelectedRow(null)
        }}
      />
    </div>
  )
}
