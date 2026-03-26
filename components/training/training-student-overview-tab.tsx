"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconBook,
  IconCalendar,
  IconCalendarOff,
  IconDotsVertical,
  IconPlane,
  IconRefresh,
  IconSchool,
  IconUser,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { TrainingOverviewRow } from "@/lib/types/training-overview"
import type { TrainingStudentOverviewResponse } from "@/lib/types/training-student-overview"

const DATE_FORMATTER = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

const TIMELINE_DATE_FORMATTER = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

const OVERVIEW_CACHE_TTL_MS = 30_000
const overviewCache = new Map<
  string,
  { data: TrainingStudentOverviewResponse; fetchedAt: number }
>()

function safeFormatDate(value: string | null | undefined) {
  if (!value) return "—"
  try {
    return DATE_FORMATTER.format(new Date(value))
  } catch {
    return "—"
  }
}

/** Calendar-day distance from today (local); for past or same-day events only. */
function formatDaysAgoLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  const now = new Date()
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diffDays = Math.round((startNow - startThen) / 86_400_000)
  if (diffDays < 0) return null
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  return `${diffDays} days ago`
}

function formatTimelineDate(value: string | null | undefined) {
  if (!value) return "—"
  try {
    return TIMELINE_DATE_FORMATTER.format(new Date(value)).toUpperCase()
  } catch {
    return "—"
  }
}

function formatName(user: { first_name: string | null; last_name: string | null; email?: string | null } | null) {
  if (!user) return "—"
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "—"
}

function progressTrack(percent: number | null, className?: string) {
  const pct = percent ?? 0
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-foreground/70 transition-all duration-500 dark:bg-foreground/60"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  )
}

const overviewCardClass =
  "rounded-xl border border-border/80 bg-card shadow-sm dark:border-border/60"

const labelClass =
  "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"

/** Outline icons: no background, aligned with label caps */
const overviewIconClass = "size-4 shrink-0 text-muted-foreground stroke-[1.75] opacity-90"
const overviewHeaderIconClass = "size-[18px] shrink-0 text-muted-foreground stroke-[1.75] opacity-90"

type TimelineEvent = {
  id: string
  date: string
  title: string
  detail?: string
  href?: string
  chip?: string
}

function enrollmentDisplayLabel(statusLabel: string | null | undefined) {
  const s = (statusLabel ?? "").trim()
  if (!s) return "IN PROGRESS"
  return s.toUpperCase()
}

export function TrainingStudentOverviewTab({ row }: { row: TrainingOverviewRow }) {
  const [data, setData] = React.useState<TrainingStudentOverviewResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = React.useState(0)

  const reload = React.useCallback(() => {
    const cacheKey = `${row.user_id}:${row.syllabus_id}`
    overviewCache.delete(cacheKey)
    setRefreshNonce((n) => n + 1)
  }, [row.syllabus_id, row.user_id])

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
  }, [row.syllabus_id, row.user_id, refreshNonce])

  const enrolledAt = data?.enrolled_at ?? row.enrolled_at
  const progress = data?.progress ?? row.progress
  const nextBooking = data?.next_booking ?? null
  const hasNextBooking = Boolean(nextBooking?.start_time)
  /** Syllabus “up next” — shown even when there is no booking yet. */
  const nextLessonTitle = hasNextBooking
    ? (nextBooking?.lesson?.name ?? data?.next_lesson?.name ?? "Scheduled lesson")
    : (data?.next_lesson?.name ?? "—")
  const lastFlightDate = data?.last_activity?.date ?? row.last_flight_at ?? null
  const lastFlightDaysAgo = formatDaysAgoLabel(lastFlightDate)
  const enrolledDaysAgo = formatDaysAgoLabel(enrolledAt)
  const enrollmentStatus = data?.enrollment_status ?? row.enrollment_status
  const instructor = row.primaryInstructor
    ? formatName({ first_name: row.primaryInstructor.first_name, last_name: row.primaryInstructor.last_name })
    : "Unassigned"

  const theory = data?.theory ?? { passed: 0, required: 0 }
  const theoryPercent =
    theory.required > 0 ? Math.round((theory.passed / theory.required) * 100) : null

  const flightPercent =
    progress.percent ?? (progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : null)

  const bookingDurationHours = React.useMemo(() => {
    if (!nextBooking?.start_time || !nextBooking?.end_time) return null
    const start = new Date(nextBooking.start_time).getTime()
    const end = new Date(nextBooking.end_time).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
    const hrs = (end - start) / (1000 * 60 * 60)
    if (hrs <= 0) return null
    const rounded = Math.round(hrs * 10) / 10
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} HOURS`
  }, [nextBooking?.end_time, nextBooking?.start_time])

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
        href: `/bookings/${nextBooking.id}`,
        chip: bookingDurationHours ?? undefined,
      })
    }

    if (data?.last_activity?.date) {
      events.push({
        id: "last-activity",
        date: data.last_activity.date,
        title: "Last lesson complete",
        detail: data.last_activity.lesson?.name ?? undefined,
      })
    } else if (row.last_flight_at) {
      events.push({
        id: "last-flight",
        date: row.last_flight_at,
        title: "Last lesson complete",
      })
    }

    if (enrolledAt) {
      events.push({
        id: "enrolled",
        date: enrolledAt,
        title: `Enrolled in ${row.syllabus.name}`,
        detail: data?.enrollment_status ?? row.enrollment_status,
      })
    }

    const withDate = events
      .map((e) => ({ e, t: new Date(e.date).getTime() }))
      .filter((x) => Number.isFinite(x.t))
      .sort((a, b) => b.t - a.t)
      .map((x) => x.e)

    return withDate
  }, [
    bookingDurationHours,
    data?.enrollment_status,
    data?.last_activity,
    enrolledAt,
    nextBooking,
    row.enrollment_status,
    row.last_flight_at,
    row.syllabus.name,
  ])

  const fullRecordHref = `/members/${row.user_id}?tab=training&syllabus_id=${row.syllabus_id}`

  if (loading && !data) {
    return (
      <div className="min-w-0 px-5 py-5 sm:px-6 sm:py-6">
        <div className="@container/overview min-w-0 space-y-6">
          <div className="grid grid-cols-1 gap-5 @[36rem]/overview:grid-cols-3 @[36rem]/overview:gap-5">
            <div className={cn(overviewCardClass, "h-28")} />
            <div className={cn(overviewCardClass, "h-28")} />
            <div className={cn(overviewCardClass, "h-28")} />
          </div>
          <div className={cn(overviewCardClass, "h-36")} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0 px-5 py-5 sm:px-6 sm:py-6">
      {error ? <div className="mb-4 text-sm text-destructive">{error}</div> : null}
      {refreshing ? (
        <div className="mb-3 text-xs text-muted-foreground">Updating…</div>
      ) : null}

      <div className="@container/overview min-w-0">
        <div className="grid min-w-0 grid-cols-1 gap-6 @[42rem]/overview:grid-cols-[minmax(0,1fr)_min(288px,34%)] @[42rem]/overview:gap-7 @[42rem]/overview:items-start">
          {/* Main column */}
          <div className="min-w-0 space-y-6">
            {/* Quick stats */}
            <div className="grid min-w-0 grid-cols-1 gap-5 @[36rem]/overview:grid-cols-3 @[36rem]/overview:gap-5">
              <div className={cn(overviewCardClass, "min-w-0 p-5 sm:p-6")}>
                <div className="flex items-center gap-2">
                  <IconUser className={overviewIconClass} aria-hidden />
                  <span className={labelClass}>Instructor</span>
                </div>
                <div className="mt-2 break-words text-base font-semibold leading-snug text-foreground" title={instructor}>
                  {instructor}
                </div>
              </div>
              <div className={cn(overviewCardClass, "min-w-0 p-5 sm:p-6")}>
                <div className="flex items-center gap-2">
                  <IconCalendar className={overviewIconClass} aria-hidden />
                  <span className={labelClass}>Last flight</span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="text-base font-semibold tabular-nums leading-snug text-foreground">
                    {safeFormatDate(lastFlightDate)}
                  </div>
                  {lastFlightDaysAgo ? (
                    <p className="text-xs font-medium leading-snug text-muted-foreground">{lastFlightDaysAgo}</p>
                  ) : null}
                </div>
              </div>
              <div className={cn(overviewCardClass, "min-w-0 p-5 sm:p-6")}>
                <div className="flex items-baseline gap-2">
                  <IconPlane className={cn(overviewIconClass, "translate-y-[3px]")} aria-hidden />
                  <span className={labelClass}>Next lesson</span>
                </div>
                <div className="mt-2 min-w-0 space-y-2">
                  <p
                    className="line-clamp-2 text-base font-semibold leading-snug text-foreground"
                    title={nextLessonTitle !== "—" ? nextLessonTitle : undefined}
                  >
                    {nextLessonTitle}
                  </p>
                  {!hasNextBooking ? (
                    <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/85">
                      <IconCalendarOff className="size-3 shrink-0 opacity-70 stroke-[1.75]" aria-hidden />
                      Not booked
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Enrolled syllabus */}
            <section className={cn(overviewCardClass, "p-6 sm:p-7")}>
              <header className="border-b border-border/60 pb-6">
                <div className="flex items-start gap-2.5">
                  <IconSchool className={cn(overviewHeaderIconClass, "mt-0.5")} aria-hidden />
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold tracking-tight text-foreground">Enrolled syllabus</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Primary certification track</p>
                  </div>
                </div>
              </header>

              <div className="mt-7 grid min-w-0 grid-cols-1 gap-8 @[36rem]/overview:grid-cols-3 @[36rem]/overview:gap-6 @[42rem]/overview:gap-10">
                <div className="min-w-0">
                  <div className={labelClass}>Course name</div>
                  <div className="mt-2.5 text-base font-semibold leading-snug text-foreground">{row.syllabus.name}</div>
                </div>
                <div className="min-w-0">
                  <div className={labelClass}>Enrolled on</div>
                  <div className="mt-2.5 space-y-1">
                    <div className="text-base font-semibold tabular-nums text-foreground">
                      {safeFormatDate(enrolledAt)}
                    </div>
                    {enrolledDaysAgo ? (
                      <p className="text-xs font-medium leading-snug text-muted-foreground">{enrolledDaysAgo}</p>
                    ) : null}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className={labelClass}>Status</div>
                  <div className="mt-2.5">
                    <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                      {enrollmentDisplayLabel(enrollmentStatus)}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Flight + theory */}
            <div className="grid min-w-0 grid-cols-1 gap-5 @[36rem]/overview:grid-cols-2 @[36rem]/overview:gap-5">
              <div className={cn(overviewCardClass, "p-6 sm:p-6")}>
                <div className="flex items-center gap-2">
                  <IconPlane className={overviewIconClass} aria-hidden />
                  <span className={labelClass}>Flight progress</span>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <span className="text-3xl font-semibold tabular-nums text-foreground">
                    {flightPercent != null ? `${flightPercent}%` : "—"}
                  </span>
                  <div className="min-w-0 flex-1">{progressTrack(flightPercent)}</div>
                </div>
                <div className="mt-5 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">{progress.completed}</span> lessons completed
                  <span className="mx-1">·</span>
                  <span className="font-semibold text-foreground">{progress.total}</span> total
                </div>
              </div>

              <div className={cn(overviewCardClass, "p-6 sm:p-6")}>
                <div className="flex items-center gap-2">
                  <IconBook className={overviewIconClass} aria-hidden />
                  <span className={labelClass}>Theory exams</span>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <span className="text-3xl font-semibold tabular-nums text-foreground">
                    {theoryPercent != null ? `${theoryPercent}%` : "—"}
                  </span>
                  <div className="min-w-0 flex-1">{progressTrack(theoryPercent)}</div>
                </div>
                <div className="mt-5 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">{theory.passed}</span> exams passed
                  <span className="mx-1">·</span>
                  <span className="font-semibold text-foreground">{theory.required}</span> total
                </div>
              </div>
            </div>
          </div>

          {/* Activity */}
          <aside className={cn(overviewCardClass, "min-w-0 p-6 sm:p-6 pt-8 @[42rem]/overview:pt-6")}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Activity</h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground">
                    <IconDotsVertical className="h-4 w-4 stroke-[1.5]" />
                    <span className="sr-only">Activity menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onSelect={() => {
                      reload()
                    }}
                  >
                    <IconRefresh className="h-4 w-4 stroke-[1.5]" />
                    Refresh overview
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={fullRecordHref}>Open full record</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="relative mt-7">
              <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border/80" aria-hidden />
              <ul className="space-y-6">
                {timeline.map((event) => {
                  return (
                    <li key={event.id} className="relative pl-8">
                      <div
                        className="absolute left-0 top-2 h-3 w-3 shrink-0 rounded-full border-2 border-background bg-primary/55 ring-1 ring-border/60"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug text-foreground">
                          {event.title}{" "}
                          <span className="font-medium uppercase tracking-wide text-muted-foreground tabular-nums">
                            ({formatTimelineDate(event.date)})
                          </span>
                        </p>
                        {event.detail ? (
                          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{event.detail}</p>
                        ) : null}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {event.chip ? (
                            <span className="inline-flex rounded-md bg-muted/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {event.chip}
                            </span>
                          ) : null}
                          {event.href ? (
                            <Link
                              href={event.href}
                              className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
                            >
                              View booking
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {!timeline.length ? (
                <p className="pl-1 text-sm leading-relaxed text-muted-foreground">No activity yet.</p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
