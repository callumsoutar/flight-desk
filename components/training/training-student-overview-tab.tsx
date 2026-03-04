"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconArrowRight,
  IconBook,
  IconCalendar,
  IconClock,
  IconPlane,
  IconTrendingUp,
  IconUser,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import type { TrainingOverviewRow } from "@/lib/types/training-overview"
import type { TrainingStudentOverviewResponse } from "@/lib/types/training-student-overview"

const DATE_FORMATTER = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

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
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-2 rounded-full bg-primary transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
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

export function TrainingStudentOverviewTab({ row }: { row: TrainingOverviewRow }) {
  const [data, setData] = React.useState<TrainingStudentOverviewResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const url = new URL(`/api/members/${row.user_id}/training/overview`, window.location.origin)
        url.searchParams.set("syllabus_id", row.syllabus_id)

        const response = await fetch(url.toString(), {
          method: "GET",
          cache: "no-store",
          headers: { "cache-control": "no-store" },
        })

        if (!response.ok) throw new Error("Failed to load overview")
        const json = (await response.json()) as TrainingStudentOverviewResponse
        if (cancelled) return
        setData(json)
      } catch (err) {
        if (cancelled) return
        setData(null)
        setError(err instanceof Error ? err.message : "Failed to load overview")
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [row.syllabus_id, row.user_id])

  const enrolledAt = data?.enrolled_at ?? row.enrolled_at
  const progress = data?.progress ?? row.progress
  const nextLesson = data?.next_lesson?.name ?? "—"
  const nextBooking = data?.next_booking ?? null
  const lastFlightDate = data?.last_activity?.date ?? row.last_flight_at ?? null
  const lastFlightAgo = daysAgo(lastFlightDate)
  const enrolledAgo = daysAgo(enrolledAt)
  const instructor = row.primaryInstructor
    ? formatName({ first_name: row.primaryInstructor.first_name, last_name: row.primaryInstructor.last_name })
    : "Unassigned"

  const theory = data?.theory ?? { passed: 0, required: 0 }
  const theoryPercent =
    theory.required > 0 ? Math.round((theory.passed / theory.required) * 100) : null

  const flightHoursTotal = data?.flight_hours_total ?? null
  const flightHoursLabel = Number.isFinite(flightHoursTotal) ? `${Math.round(flightHoursTotal as number)}h` : "—"

  const lessonsPerMonth = data?.lessons_per_month ?? null
  const velocityIsUnderOne =
    typeof lessonsPerMonth === "number" && lessonsPerMonth > 0 && lessonsPerMonth < 1
  const lessonsPerMonthLabel =
    typeof lessonsPerMonth === "number" ? (velocityIsUnderOne ? "<1" : lessonsPerMonth.toFixed(1)) : "—"
  const lessonsPerMonthHint = velocityIsUnderOne ? "Less than one a month" : null

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

  if (loading && !data) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-5 w-56 rounded bg-muted/50" />
        <div className="h-24 w-full rounded-xl border bg-card" />
        <div className="h-32 w-full rounded-xl border bg-card" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {error ? <div className="text-sm text-muted-foreground">{error}</div> : null}

      <div className="rounded-xl border bg-muted/20 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold truncate">{fullName(row)}</h3>
            <p className="text-sm text-muted-foreground truncate">{row.syllabus.name}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground">Enrolled</div>
            <div className="text-sm font-medium tabular-nums">{safeFormatDate(enrolledAt)}</div>
            {enrolledAgo ? (
              <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{enrolledAgo}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
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
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-2 min-w-0">
              <item.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="text-sm font-medium truncate">{item.value}</div>
                {"sub" in item && item.sub ? (
                  <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{item.sub}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <IconPlane className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-semibold">Syllabus Completion</div>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {progress.completed}/{progress.total}
            </div>
          </div>
          <div className="mt-3">{progressBar(progress.percent)}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            {progress.total ? `${progress.completed} of ${progress.total} lessons completed` : "No lessons configured yet."}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <IconBook className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-semibold">Theory Exams</div>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {theory.required > 0 ? `${theory.passed}/${theory.required}` : "—"}
            </div>
          </div>
          <div className="mt-3">{progressBar(theoryPercent)}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            {theory.required > 0 ? `${theory.passed} of ${theory.required} exams passed` : "No exams configured for this syllabus."}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="text-sm font-semibold">Timeline</div>
        <div className="mt-4 relative">
          <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
          <div className="space-y-4">
            {timeline.map((event, idx) => {
              const Icon = event.icon
              const isFirst = idx === 0
              return (
                <div key={event.id} className="relative pl-8">
                  <div
                    className={cn(
                      "absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 bg-background",
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
                    <div className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {safeFormatDate(event.date)}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <IconClock className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-semibold">Flight Hours</div>
          </div>
          <div className="mt-3 text-3xl font-semibold tabular-nums">{flightHoursLabel}</div>
          <div className="mt-1 text-xs text-muted-foreground">Total logged hours</div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-semibold">Training Velocity</div>
          </div>
          <div className="mt-3 text-3xl font-semibold tabular-nums">{lessonsPerMonthLabel}</div>
          {lessonsPerMonthHint ? (
            <div className="mt-1 text-xs text-muted-foreground">{lessonsPerMonthHint}</div>
          ) : null}
          <div className={cn("mt-1 text-xs text-muted-foreground", lessonsPerMonthHint ? "mt-0.5" : "")}>
            Lessons per month
          </div>
        </div>
      </div>
    </div>
  )
}
