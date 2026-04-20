"use client"

import * as React from "react"
import Link from "next/link"
import { IconCalendarEvent, IconChevronRight } from "@tabler/icons-react"

import { BookingStatusBadge } from "@/components/dashboard/booking-status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getBookingOpenPath } from "@/lib/bookings/navigation"
import type { BookingStatus } from "@/lib/types/bookings"
import type { DashboardBookingLite, DashboardViewerKind } from "@/lib/types/dashboard"

function formatUser(user: DashboardBookingLite["student"]) {
  if (!user) return "—"
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
  return name || user.email || "—"
}

function formatInstructor(instructor: DashboardBookingLite["instructor"]) {
  if (!instructor) return null
  const name = [instructor.first_name, instructor.last_name].filter(Boolean).join(" ").trim()
  if (name) return name
  if (instructor.user) {
    const u = [instructor.user.first_name, instructor.user.last_name].filter(Boolean).join(" ").trim()
    if (u) return u
    return instructor.user.email
  }
  return null
}

function formatTime(value: string, timeZone: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)
}

function formatDuration(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null
  const totalMinutes = Math.round((end - start) / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function zonedDateKey(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}

function formatShortBookingDay(iso: string, timeZone: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date)
}

const ACCENT_BY_STATUS: Record<BookingStatus, string> = {
  unconfirmed: "bg-slate-300 dark:bg-slate-700",
  confirmed: "bg-emerald-500",
  briefing: "bg-amber-500",
  flying: "bg-indigo-500",
  complete: "bg-slate-400 dark:bg-slate-600",
  cancelled: "bg-red-400",
}

export function UpcomingTodayCard({
  bookings,
  timeZone,
  viewerKind,
  nowIso,
}: {
  bookings: DashboardBookingLite[]
  timeZone: string
  viewerKind: DashboardViewerKind
  nowIso: string
}) {
  const isMember = viewerKind === "member"
  const todayKey = zonedDateKey(nowIso, timeZone)
  const nowMs = new Date(nowIso).getTime()

  // Highlight the next upcoming booking that hasn't started yet (staff view only).
  const nextUpId = React.useMemo(() => {
    if (isMember) return null
    const next = bookings
      .filter((b) => new Date(b.start_time).getTime() > nowMs)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]
    return next?.id ?? null
  }, [bookings, nowMs, isMember])

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">
            {isMember ? "Upcoming bookings" : "Today's schedule"}
          </CardTitle>
          <CardDescription className="text-xs">
            {isMember
              ? "Confirmed and in-progress bookings on your schedule"
              : "Upcoming bookings for the rest of today"}
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-xs">
          <Link href={isMember ? "/bookings" : "/scheduler"}>
            {isMember ? "My bookings" : "Scheduler"} <IconChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="pt-0">
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <IconCalendarEvent className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">No upcoming bookings</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isMember ? "Nothing confirmed on your schedule yet." : "Nothing scheduled for the rest of today."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border">
            {bookings.map((booking) => {
              const studentName = formatUser(booking.student)
              const aircraft = booking.aircraft?.registration ?? "No aircraft"
              const instructor = formatInstructor(booking.instructor)
              const href = getBookingOpenPath(booking.id, booking.status)
              const startKey = zonedDateKey(booking.start_time, timeZone)
              const showDay = isMember && startKey !== todayKey
              const startLabel = formatTime(booking.start_time, timeZone)
              const endLabel = formatTime(booking.end_time, timeZone)
              const duration = formatDuration(booking.start_time, booking.end_time)
              const isNext = booking.id === nextUpId
              const accent = ACCENT_BY_STATUS[booking.status] ?? "bg-slate-300"

              const primary = isMember ? aircraft : studentName
              const secondaryParts = isMember
                ? [instructor].filter(Boolean)
                : [aircraft, instructor].filter(Boolean)
              const secondary = secondaryParts.join(" · ")

              return (
                <li key={booking.id} className="relative">
                  <Link
                    href={href}
                    className="group flex items-stretch gap-3 bg-card px-3 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className={cn("w-1 shrink-0 rounded-full", accent)} aria-hidden />

                    <div className="flex w-[68px] shrink-0 flex-col items-start justify-center">
                      <span className="text-sm font-semibold tabular-nums leading-none text-foreground">
                        {startLabel}
                      </span>
                      <span className="mt-1 text-[11px] tabular-nums leading-none text-muted-foreground">
                        {duration ?? endLabel}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 self-center">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-foreground">{primary}</span>
                        {isNext ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Next up
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {showDay ? (
                          <span className="mr-1.5 font-medium text-foreground/80">
                            {formatShortBookingDay(booking.start_time, timeZone)}
                          </span>
                        ) : null}
                        {secondary || (showDay ? null : <span aria-hidden>—</span>)}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 self-center">
                      <BookingStatusBadge status={booking.status} className="shrink-0" />
                      <IconChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
