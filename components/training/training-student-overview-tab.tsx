"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconArrowRight,
  IconBook,
  IconCalendar,
  IconPlane,
  IconUser,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { cn, getUserInitials } from "@/lib/utils"
import type { TrainingOverviewRow } from "@/lib/types/training-overview"
import type { TrainingStudentOverviewResponse } from "@/lib/types/training-student-overview"

const DATE_FORMATTER = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

const OVERVIEW_CACHE_TTL_MS = 30_000
const overviewCache = new Map<
  string,
  { data: TrainingStudentOverviewResponse; fetchedAt: number }
>()

function daysAgo(value: string | null | undefined) {
  if (!value) return null
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return null
  const diffMs = Date.now() - dt.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (!Number.isFinite(days)) return null
  if (days < 0) return null
  if (days === 0) return "today"
  if (days === 1) return "1 day ago"
  return `${days} days ago`
}

function safeFormatDate(value: string | null | undefined) {
  if (!value) return "—"
  try {
    return DATE_FORMATTER.format(new Date(value))
  } catch {
    return "—"
  }
}

function formatName(user: { first_name: string | null; last_name: string | null; email?: string | null } | null) {
  if (!user) return "—"
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "—"
}

function fullName(row: TrainingOverviewRow) {
  const first = row.student.first_name ?? ""
  const last = row.student.last_name ?? ""
  const name = `${first} ${last}`.trim()
  return name.length ? name : row.student.email ?? "Student"
}

function progressBar(percent: number | null) {
  const pct = percent ?? 0
  return (
    <div className="h-2 w-full rounded-full bg-muted/70 overflow-hidden">
      <div
        className="h-2 rounded-full bg-primary transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  )
}

function percentChip(value: number | null | undefined) {
  if (typeof value !== "number") return null
  return (
    <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
      {Math.max(0, Math.min(100, Math.round(value)))}%
    </span>
  )
}

type TimelineEvent = {
  id: string
  date: string
  title: string
  detail?: string
  icon: React.ElementType
  href?: string
}

function enrollmentBadge(statusLabel: string | null | undefined) {
  const s = (statusLabel ?? "").toLowerCase()
  if (s.includes("active")) {
    return { label: "Active", className: "border-emerald-200/60 bg-emerald-50 text-emerald-700" }
  }
  if (s.includes("completed")) {
    return { label: "Completed", className: "border-slate-200/60 bg-slate-50 text-slate-700" }
  }
  if (s.includes("withdrawn")) {
    return { label: "Withdrawn", className: "border-amber-200/60 bg-amber-50 text-amber-800" }
  }
  if (!statusLabel) return null
  return { label: statusLabel, className: "border-border bg-muted/20 text-muted-foreground" }
}

export function TrainingStudentOverviewTab({ row }: { row: TrainingOverviewRow }) {
  const [data, setData] = React.useState<TrainingStudentOverviewResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const cacheKey = `${row.user_id}:${row.syllabus_id}`
    const cached = overviewCache.get(cacheKey)
    const isFresh = cached && Date.now() - cached.fetchedAt < OVERVIEW_CACHE_TTL_MS

    if (cached) {
      setData(cached.data)
      setLoading(false)
      setError(null)
    }

    if (isFresh) return

    const controller = new AbortController()

    async function load() {
      if (!cached) setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const url = new URL(`/api/members/${row.user_id}/training/overview`, window.location.origin)
        url.searchParams.set("syllabus_id", row.syllabus_id)

        const response = await fetch(url.toString(), {
          method: "GET",
          cache: "no-store",
          headers: { "cache-control": "no-store" },
          signal: controller.signal,
        })

        if (!response.ok) throw new Error("Failed to load overview")
        const json = (await response.json()) as TrainingStudentOverviewResponse
        if (controller.signal.aborted) return
        overviewCache.set(cacheKey, { data: json, fetchedAt: Date.now() })
        setData(json)
      } catch (err) {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : "Failed to load overview"
        setError(message)
        if (!cached) setData(null)
      } finally {
        if (controller.signal.aborted) return
        setRefreshing(false)
        setLoading(false)
      }
    }

    void load()
    return () => {
      controller.abort()
    }
  }, [row.syllabus_id, row.user_id])

  const enrolledAt = data?.enrolled_at ?? row.enrolled_at
  const progress = data?.progress ?? row.progress
  const nextLesson = data?.next_lesson?.name ?? "—"
  const nextBooking = data?.next_booking ?? null
  const lastFlightDate = data?.last_activity?.date ?? row.last_flight_at ?? null
  const lastFlightAgo = daysAgo(lastFlightDate)
  const enrolledAgo = daysAgo(enrolledAt)
  const enrollmentStatus = data?.enrollment_status ?? row.enrollment_status
  const enrollmentChip = enrollmentBadge(enrollmentStatus)
  const instructor = row.primaryInstructor
    ? formatName({ first_name: row.primaryInstructor.first_name, last_name: row.primaryInstructor.last_name })
    : "Unassigned"

  const theory = data?.theory ?? { passed: 0, required: 0 }
  const theoryPercent =
    theory.required > 0 ? Math.round((theory.passed / theory.required) * 100) : null

  const timeline = React.useMemo(() => {
    const events: TimelineEvent[] = []

    if (nextBooking?.start_time) {
      const lessonName = nextBooking.lesson?.name ?? "Booking"
      const detailBits = [
        nextBooking.instructor
          ? formatName({
              first_name: nextBooking.instructor.user?.first_name ?? nextBooking.instructor.first_name,
              last_name: nextBooking.instructor.user?.last_name ?? nextBooking.instructor.last_name,
              email: nextBooking.instructor.user?.email ?? null,
            })
          : null,
        nextBooking.aircraft?.registration ?? null,
      ].filter(Boolean)

      events.push({
        id: "next-booking",
        date: nextBooking.start_time,
        title: "Next booking",
        detail: detailBits.length ? `${lessonName} · ${detailBits.join(" · ")}` : lessonName,
        icon: IconArrowRight,
        href: `/bookings/${nextBooking.id}`,
      })
    }

    if (data?.last_activity?.date) {
      events.push({
        id: "last-activity",
        date: data.last_activity.date,
        title: "Last lesson",
        detail: data.last_activity.lesson?.name ?? undefined,
        icon: IconPlane,
      })
    } else if (row.last_flight_at) {
      events.push({
        id: "last-flight",
        date: row.last_flight_at,
        title: "Last lesson",
        icon: IconPlane,
      })
    }

    if (enrolledAt) {
      events.push({
        id: "enrolled",
        date: enrolledAt,
        title: "Enrolled",
        detail: data?.enrollment_status ?? row.enrollment_status,
        icon: IconCalendar,
      })
    }

    const withDate = events
      .map((e) => ({ e, t: new Date(e.date).getTime() }))
      .filter((x) => Number.isFinite(x.t))
      .sort((a, b) => b.t - a.t)
      .map((x) => x.e)

    return withDate
  }, [data?.enrollment_status, data?.last_activity, enrolledAt, nextBooking, row.enrollment_status, row.last_flight_at])

  const initials = React.useMemo(() => {
    return getUserInitials(row.student.first_name, row.student.last_name, row.student.email)
  }, [row.student.email, row.student.first_name, row.student.last_name])

  const hasIdentity = React.useMemo(() => {
    const first = row.student.first_name?.trim()
    const last = row.student.last_name?.trim()
    const email = row.student.email?.trim()
    return Boolean(first || last || email)
  }, [row.student.email, row.student.first_name, row.student.last_name])

  if (loading && !data) {
    return (
      <div className="px-4 py-5 sm:p-6 space-y-4">
        <div className="h-5 w-56 rounded bg-muted/50" />
        <div className="h-24 w-full rounded-xl border bg-card" />
        <div className="h-32 w-full rounded-xl border bg-card" />
      </div>
    )
  }

  return (
    <div className="px-4 py-5 sm:p-6 space-y-6">
      {error ? <div className="text-sm text-muted-foreground">{error}</div> : null}
      {refreshing ? (
        <div className="text-xs text-muted-foreground">Updating…</div>
      ) : null}

      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between p-5">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/40 text-foreground/70 shrink-0 border border-border/60">
              {hasIdentity ? (
                <span className="text-xs font-bold">{initials}</span>
              ) : (
                <IconUser className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold truncate">{fullName(row)}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-sm text-muted-foreground truncate">{row.syllabus.name}</p>
                {enrollmentChip ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 rounded-md px-2 text-[10px] font-bold uppercase tracking-wide shadow-none",
                      enrollmentChip.className
                    )}
                  >
                    {enrollmentChip.label}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <div className="text-xs text-muted-foreground">Enrolled</div>
            <div className="text-sm font-medium tabular-nums">{safeFormatDate(enrolledAt)}</div>
            {enrolledAgo ? (
              <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{enrolledAgo}</div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-border/60 flex flex-wrap bg-muted/10">
          {[
            { icon: IconUser, label: "Instructor", value: instructor },
            {
              icon: IconCalendar,
              label: "Last flight",
              value: safeFormatDate(lastFlightDate),
              sub: lastFlightAgo,
            },
            {
              icon: IconArrowRight,
              label: "Next booking",
              value: nextBooking ? safeFormatDate(nextBooking.start_time) : "Not booked",
            },
            { icon: IconBook, label: "Next lesson", value: nextLesson },
          ].map((item, idx, all) => {
            const isTopRow = idx < 2
            const isLeft = idx % 2 === 0
            const isLast = idx === all.length - 1
            return (
              <div
                key={item.label}
                className={cn(
                  "w-full sm:w-1/2 px-5 py-4 border-border/60",
                  !isLast ? "border-b" : "",
                  isTopRow ? "sm:border-b" : "sm:border-b-0",
                  isLeft ? "sm:border-r" : ""
                )}
              >
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
                <div className="mt-1 text-sm font-semibold truncate">{item.value}</div>
                {"sub" in item && item.sub ? (
                  <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{item.sub}</div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <IconPlane className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-semibold">Syllabus Completion</div>
            </div>
            <div className="flex items-center gap-2">
              {percentChip(progress.percent)}
              <div className="text-xs text-muted-foreground tabular-nums">
                {progress.completed}/{progress.total}
              </div>
            </div>
          </div>
          <div className="mt-3">{progressBar(progress.percent)}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            {progress.total ? `${progress.completed} of ${progress.total} lessons completed` : "No lessons configured yet."}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <IconBook className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-semibold">Theory Exams</div>
            </div>
            <div className="flex items-center gap-2">
              {percentChip(theoryPercent)}
              <div className="text-xs text-muted-foreground tabular-nums">
                {theory.required > 0 ? `${theory.passed}/${theory.required}` : "—"}
              </div>
            </div>
          </div>
          <div className="mt-3">{progressBar(theoryPercent)}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            {theory.required > 0 ? `${theory.passed} of ${theory.required} exams passed` : "No exams configured for this syllabus."}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/20">
          <div className="text-sm font-semibold">Timeline</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {timeline.length ? `${timeline.length} event${timeline.length === 1 ? "" : "s"}` : "—"}
          </div>
        </div>
        <div className="px-5 py-5 relative">
          <div className="absolute left-7 top-6 bottom-6 w-px bg-border" />
          <div className="space-y-5">
            {timeline.map((event, idx) => {
              const Icon = event.icon
              const isFirst = idx === 0
              return (
                <div key={event.id} className="relative pl-10">
                  <div
                    className={cn(
                      "absolute left-5 top-1.5 h-3.5 w-3.5 rounded-full border-2 bg-background",
                      isFirst ? "border-primary" : "border-border"
                    )}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm font-medium">{event.title}</div>
                      </div>
                      {event.detail ? (
                        <div className="mt-0.5 text-xs text-muted-foreground truncate">{event.detail}</div>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground tabular-nums">{safeFormatDate(event.date)}</div>
                      {daysAgo(event.date) ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground/80 tabular-nums">
                          {daysAgo(event.date)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {event.href ? (
                    <div className="mt-2">
                      <Link
                        href={event.href}
                        className="text-xs font-medium text-primary hover:underline underline-offset-4"
                      >
                        View booking
                      </Link>
                    </div>
                  ) : null}
                </div>
              )
            })}
            {!timeline.length ? (
              <div className="text-sm text-muted-foreground">No activity yet.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
