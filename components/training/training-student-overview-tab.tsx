"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconCalendar,
  IconChartBar,
  IconCheck,
  IconClock,
  IconExternalLink,
  IconPlane,
  IconRefresh,
  IconSchool,
  IconShield,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { cn, getUserInitials } from "@/lib/utils"
import type { TrainingOverviewRow } from "@/lib/types/training-overview"
import type { TrainingStudentOverviewResponse } from "@/lib/types/training-student-overview"

const DATE_FORMATTER = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

const KEY_DATE_FORMATTER = new Intl.DateTimeFormat("en-NZ", {
  day: "2-digit",
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

const overviewCardClass =
  "rounded-xl border border-border/80 bg-card shadow-sm dark:border-border/60"

const labelUpper =
  "text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"

const sectionHeading = cn(labelUpper, "mb-2.5")

function safeFormatDate(value: string | null | undefined) {
  if (!value) return "—"
  try {
    return DATE_FORMATTER.format(new Date(value))
  } catch {
    return "—"
  }
}

function safeFormatKeyDate(value: string | null | undefined) {
  if (!value) return "—"
  try {
    return KEY_DATE_FORMATTER.format(new Date(value))
  } catch {
    return "—"
  }
}

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

function formatTimelineDateUpper(value: string | null | undefined) {
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

function formatBookingDurationHours(start: string, end: string): string | null {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null
  const hrs = (endMs - startMs) / (1000 * 60 * 60)
  if (hrs <= 0) return null
  const rounded = Math.round(hrs * 10) / 10
  if (rounded <= 1 && rounded > 0.9) return "1 hour"
  if (rounded % 1 === 0) return `${rounded.toFixed(0)} hours`
  return `${rounded} hours`
}

function enrollmentDisplayLabel(statusLabel: string | null | undefined) {
  const s = (statusLabel ?? "").trim()
  if (!s) return "In progress"
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

type TimelineEvent = {
  id: string
  date: string
  isUpcoming: boolean
  dateLine: string
  title: string
  detail?: string
  href?: string
}

const overviewIcon = "size-3 shrink-0 opacity-70 stroke-[1.75] text-muted-foreground"

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
  const nextLessonTitle = hasNextBooking
    ? (nextBooking?.lesson?.name ?? data?.next_lesson?.name ?? "Scheduled lesson")
    : (data?.next_lesson?.name ?? null)
  const lastFlightDate = data?.last_activity?.date ?? row.last_flight_at ?? null
  const lastFlightDaysAgo = formatDaysAgoLabel(lastFlightDate)
  const enrolledDaysAgo = formatDaysAgoLabel(enrolledAt)
  const enrollmentStatus = data?.enrollment_status ?? row.enrollment_status
  const enrollmentLabel = enrollmentDisplayLabel(enrollmentStatus)

  const instructorName = row.primaryInstructor
    ? formatName({
        first_name: row.primaryInstructor.first_name,
        last_name: row.primaryInstructor.last_name,
      })
    : "Unassigned"

  const instructorInitials = row.primaryInstructor
    ? getUserInitials(row.primaryInstructor.first_name, row.primaryInstructor.last_name, null)
    : "—"

  const theory = data?.theory ?? { passed: 0, required: 0 }
  const theoryPercent =
    theory.required > 0 ? Math.round((theory.passed / theory.required) * 100) : null

  const flightPercent =
    progress.percent ?? (progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : null)

  const bookingDurationLabel = React.useMemo(() => {
    if (!nextBooking?.start_time || !nextBooking?.end_time) return null
    return formatBookingDurationHours(nextBooking.start_time, nextBooking.end_time)
  }, [nextBooking?.end_time, nextBooking?.start_time])

  const nextLessonDateLabel = hasNextBooking && nextBooking?.start_time ? safeFormatDate(nextBooking.start_time) : null
  const nextLessonMeta = [
    nextLessonDateLabel,
    bookingDurationLabel,
    nextBooking?.aircraft?.registration ?? null,
  ].filter((value): value is string => Boolean(value))

  const remainingLessons = Math.max(0, progress.total - progress.completed)

  const timeline = React.useMemo(() => {
    const upcoming: TimelineEvent[] = []
    const past: TimelineEvent[] = []

    if (nextBooking?.start_time) {
      const lessonName = nextBooking.lesson?.name ?? "Booking"
      const instructorFormatted = nextBooking.instructor
        ? formatName({
            first_name: nextBooking.instructor.user?.first_name ?? nextBooking.instructor.first_name,
            last_name: nextBooking.instructor.user?.last_name ?? nextBooking.instructor.last_name,
            email: nextBooking.instructor.user?.email ?? null,
          })
        : null
      const detailBits = [
        instructorFormatted ? `With ${instructorFormatted}` : null,
        nextBooking.aircraft?.registration ?? null,
        bookingDurationLabel,
      ].filter(Boolean)

      upcoming.push({
        id: "next-booking",
        date: nextBooking.start_time,
        isUpcoming: true,
        dateLine: `${formatTimelineDateUpper(nextBooking.start_time)} · UPCOMING`,
        title: lessonName,
        detail: detailBits.length ? detailBits.join(" · ") : undefined,
        href: `/bookings/${nextBooking.id}`,
      })
    }

    if (data?.last_activity?.date) {
      past.push({
        id: "last-activity",
        date: data.last_activity.date,
        isUpcoming: false,
        dateLine: formatTimelineDateUpper(data.last_activity.date),
        title: "Lesson complete",
        detail: data.last_activity.lesson?.name ?? undefined,
      })
    } else if (row.last_flight_at) {
      past.push({
        id: "last-flight",
        date: row.last_flight_at,
        isUpcoming: false,
        dateLine: formatTimelineDateUpper(row.last_flight_at),
        title: "Lesson complete",
      })
    }

    if (enrolledAt) {
      past.push({
        id: "enrolled",
        date: enrolledAt,
        isUpcoming: false,
        dateLine: formatTimelineDateUpper(enrolledAt),
        title: "Enrolled in training",
        detail: `${row.syllabus.name} · ${enrollmentLabel}`,
      })
    }

    past.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return [...upcoming, ...past]
  }, [
    bookingDurationLabel,
    data?.last_activity,
    enrollmentLabel,
    enrolledAt,
    nextBooking,
    row.last_flight_at,
    row.syllabus.name,
  ])

  const fullRecordHref = `/members/${row.user_id}?tab=training&syllabus_id=${row.syllabus_id}`
  const instructorProfileHref = row.primaryInstructor ? `/instructors/${row.primaryInstructor.id}` : null

  const theoryStatusSub =
    theory.required <= 0
      ? "No exams configured"
      : theory.passed === 0
        ? "Not yet started"
        : `${theoryPercent}% passed`

  if (loading && !data) {
    return (
      <div className="min-w-0 px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-[1100px] space-y-8 animate-pulse">
          <div className={cn(overviewCardClass, "h-28")} />
          <div className={cn(overviewCardClass, "h-32")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={cn(overviewCardClass, "h-36")} />
            <div className={cn(overviewCardClass, "h-36")} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0 px-4 py-5 sm:px-6 text-foreground">
      {error ? <div className="mb-4 text-sm text-destructive">{error}</div> : null}
      {refreshing ? <div className="mb-2 text-xs text-muted-foreground">Updating…</div> : null}

      <div className="mx-auto max-w-[1100px]">
        <div className="grid min-w-0 grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start xl:gap-8">
          {/* Main column */}
          <div className="min-w-0 space-y-7">
            {/* Status row */}
            <div
              className={cn(
                overviewCardClass,
                "grid overflow-hidden p-0",
                "grid-cols-1 sm:grid-cols-3",
                "[&>div]:border-b [&>div]:border-border/60 [&>div:last-child]:border-b-0 sm:[&>div]:min-h-[108px] sm:[&>div]:border-b-0 sm:[&>div]:border-r sm:[&>div:last-child]:border-r-0"
              )}
            >
              <div className="px-5 py-4 sm:px-6">
                <div className={cn("mb-1.5 flex items-center gap-1.5", labelUpper)}>
                  <IconCalendar className={overviewIcon} aria-hidden />
                  Last flight
                </div>
                <div className="text-base font-semibold leading-snug">{safeFormatDate(lastFlightDate)}</div>
                {lastFlightDaysAgo ? (
                  <div className="mt-0.5 text-xs text-muted-foreground">{lastFlightDaysAgo}</div>
                ) : null}
              </div>
              <div className="px-5 py-4 sm:px-6">
                <div className={cn("mb-1.5 flex items-center gap-1.5", labelUpper)}>
                  <IconPlane className={overviewIcon} aria-hidden />
                  Flight progress
                </div>
                <div className="text-base font-semibold leading-snug">
                  {progress.total > 0 ? (
                    <>
                      {progress.completed} of {progress.total} lessons
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {flightPercent != null ? `${flightPercent}% complete` : "No lessons yet"}
                </div>
              </div>
              <div className="px-5 py-4 sm:px-6">
                <div className={cn("mb-1.5 flex items-center gap-1.5", labelUpper)}>
                  <IconChartBar className={overviewIcon} aria-hidden />
                  Theory exams
                </div>
                <div className="text-base font-semibold leading-snug">
                  {theory.required > 0 ? (
                    <>
                      {theory.passed} of {theory.required} passed
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{theoryStatusSub}</div>
              </div>
            </div>

            {/* Up next */}
            <div className={cn(overviewCardClass, "overflow-hidden")}>
              <div className="border-l-2 border-l-primary/60 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                  <div className="min-w-0 flex-1">
                    <p className={cn(labelUpper, "inline-flex items-center gap-1.5")}>
                      <IconCalendar className={overviewIcon} aria-hidden />
                      Up next
                    </p>
                    <p className="mt-1.5 text-base font-semibold leading-tight text-foreground sm:text-lg">
                      {nextLessonTitle ?? "No lesson scheduled"}
                    </p>
                    {nextLessonMeta.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {nextLessonMeta.map((item) => (
                          <span
                            key={item}
                            className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Book a lesson to keep progress moving.
                      </p>
                    )}
                  </div>
                  {hasNextBooking && nextBooking ? (
                    <Link
                      href={`/bookings/${nextBooking.id}`}
                      className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline sm:pt-0.5"
                    >
                      View booking
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Training progress */}
            <section>
              <h3 className={sectionHeading}>Training progress</h3>
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <div className={cn(overviewCardClass, "h-full p-5")}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className={cn("flex items-center gap-1.5", labelUpper)}>
                      <IconPlane className="size-3.5 stroke-[1.75]" aria-hidden />
                      Flight lessons
                    </span>
                  </div>
                  <div className="mb-2.5 text-3xl font-semibold tabular-nums text-foreground">
                    {flightPercent != null ? `${flightPercent}%` : "—"}
                  </div>
                  <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, flightPercent ?? 0))}%` }}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">{progress.completed}</span> completed ·{" "}
                    <span className="font-semibold text-foreground">{remainingLessons}</span> remaining
                  </p>
                </div>

                <div className={cn(overviewCardClass, "h-full p-5")}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className={cn("flex items-center gap-1.5", labelUpper)}>
                      <IconSchool className="size-3.5 stroke-[1.75]" aria-hidden />
                      Theory exams
                    </span>
                  </div>
                  <div
                    className={cn(
                      "mb-2.5 text-3xl font-semibold tabular-nums",
                      theoryPercent === 0 || theoryPercent == null ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {theoryPercent != null ? `${theoryPercent}%` : "—"}
                  </div>
                  <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-500 dark:bg-emerald-500"
                      style={{ width: `${Math.max(0, Math.min(100, theoryPercent ?? 0))}%` }}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">{theory.passed}</span> passed ·{" "}
                    <span className="font-semibold text-foreground">{theory.required}</span> total
                  </p>
                </div>
              </div>
            </section>

            {/* Enrolled syllabus */}
            <section>
              <h3 className={sectionHeading}>Enrolled syllabus</h3>
              <div className={cn(overviewCardClass, "overflow-hidden")}>
                <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{row.syllabus.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">Primary certification track</div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <IconCalendar className="size-3 shrink-0 stroke-[1.75]" aria-hidden />
                      Enrolled {safeFormatDate(enrolledAt)}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        enrollmentLabel.toLowerCase() === "active"
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-muted-foreground"
                      )}
                    >
                      <IconCheck className="size-3 shrink-0 stroke-[1.75]" aria-hidden />
                      {enrollmentLabel}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 px-5 py-4 text-xs text-muted-foreground">
                  <IconShield className="mt-0.5 size-[13px] shrink-0 stroke-[1.75] opacity-80" aria-hidden />
                  <span>
                    {enrolledDaysAgo ? (
                      <>
                        Enrolled {enrolledDaysAgo} · status is{" "}
                        <strong className="font-semibold text-foreground">{enrollmentLabel.toLowerCase()}</strong>
                      </>
                    ) : (
                      <>
                        Status is <strong className="font-semibold text-foreground">{enrollmentLabel.toLowerCase()}</strong>
                      </>
                    )}{" "}
                    ·{" "}
                    <Link
                      href={fullRecordHref}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      View full syllabus →
                    </Link>
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="min-w-0 space-y-6">
            <section>
              <div className={cn(overviewCardClass, "p-4 sm:p-5")}>
                <h3 className={cn(labelUpper, "mb-3")}>Instructor</h3>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {instructorInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">{instructorName}</div>
                    <div className="text-xs text-muted-foreground">Flight instructor</div>
                  </div>
                  {instructorProfileHref ? (
                    <Link
                      href={instructorProfileHref}
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-primary"
                      aria-label="Open instructor profile"
                    >
                      <IconExternalLink className="size-3.5 stroke-[1.75]" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>

            <section>
              <h3 className={sectionHeading}>Key dates</h3>
              <div className={cn(overviewCardClass, "overflow-hidden")}>
                <div className="divide-y divide-border/60">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs sm:text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <IconCalendar className="size-3 shrink-0 stroke-[1.75]" aria-hidden />
                      Enrolled
                    </span>
                    <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground sm:text-xs">
                      {safeFormatKeyDate(enrolledAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs sm:text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <IconPlane className="size-3 shrink-0 stroke-[1.75]" aria-hidden />
                      Last flight
                    </span>
                    <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground sm:text-xs">
                      {safeFormatKeyDate(lastFlightDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs sm:text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <IconClock className="size-3 shrink-0 stroke-[1.75]" aria-hidden />
                      Next lesson
                    </span>
                    <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground sm:text-xs">
                      {hasNextBooking && nextBooking?.start_time ? safeFormatKeyDate(nextBooking.start_time) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className={cn(overviewCardClass, "p-4 sm:p-5")}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className={cn(labelUpper, "mb-0")}>Activity</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => reload()}
                    aria-label="Refresh overview"
                  >
                    <IconRefresh className={cn("size-4 stroke-[1.5]", refreshing && "animate-spin")} />
                  </Button>
                </div>

                <div className="flex flex-col">
                  {timeline.map((event, index) => (
                    <div key={event.id} className="relative flex gap-3.5 pb-5 last:pb-0">
                      {index < timeline.length - 1 ? (
                        <div className="absolute left-[6px] top-3.5 bottom-0 w-px bg-border" aria-hidden />
                      ) : null}
                      <div
                        className={cn(
                          "relative z-[1] mt-0.5 size-[13px] shrink-0 rounded-full border-2",
                          event.isUpcoming
                            ? "border-primary bg-primary"
                            : "border-border bg-background"
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className={cn(labelUpper, "mb-0.5 tracking-[0.05em]")}>{event.dateLine}</div>
                        <div className="text-sm font-semibold leading-snug text-foreground">{event.title}</div>
                        {event.detail ? (
                          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{event.detail}</div>
                        ) : null}
                        {event.href ? (
                          <Link
                            href={event.href}
                            className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
                          >
                            <IconCalendar className="size-2.5 stroke-[1.75]" aria-hidden />
                            View booking
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {!timeline.length ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">No activity yet.</p>
                  ) : null}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
