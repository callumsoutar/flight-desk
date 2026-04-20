"use client"

import * as React from "react"
import Link from "next/link"
import { IconChevronRight, IconNavigation, IconPlane } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getBookingOpenPath } from "@/lib/bookings/navigation"
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

function formatDuration(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

type FlightProgress = {
  /** Total scheduled minutes for the booking. */
  totalMinutes: number
  /** Minutes elapsed since start, capped to total. */
  elapsedMinutes: number
  /** Percentage 0-100 of elapsed/total, capped to 100 when not overdue. */
  percent: number
  /** Minutes remaining (negative = overdue). */
  remainingMinutes: number
  overdue: boolean
}

function getFlightProgress({
  startIso,
  endIso,
  nowIso,
}: {
  startIso: string
  endIso: string
  nowIso: string
}): FlightProgress | null {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  const now = new Date(nowIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(now)) {
    return null
  }
  if (end <= start) return null
  const totalMinutes = Math.round((end - start) / 60000)
  const elapsedRaw = Math.round((now - start) / 60000)
  const elapsedMinutes = Math.max(0, Math.min(elapsedRaw, totalMinutes))
  const remainingMinutes = Math.round((end - now) / 60000)
  const overdue = remainingMinutes < 0
  const percent = totalMinutes > 0 ? Math.min(100, Math.max(0, (elapsedMinutes / totalMinutes) * 100)) : 0
  return { totalMinutes, elapsedMinutes, percent, remainingMinutes, overdue }
}

function formatRemaining(progress: FlightProgress) {
  const abs = Math.abs(progress.remainingMinutes)
  const label = formatDuration(abs)
  return progress.overdue ? `Overdue ${label}` : `Due in ${label}`
}

export function FlyingNowCard({
  bookings,
  timeZone,
  nowIso,
  viewerKind,
}: {
  bookings: DashboardBookingLite[]
  timeZone: string
  nowIso: string
  viewerKind: DashboardViewerKind
}) {
  const isMember = viewerKind === "member"
  const count = bookings.length

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            Flying now
            {count > 0 ? (
              <span
                className="relative flex h-2 w-2"
                aria-label={`${count} active ${count === 1 ? "flight" : "flights"}`}
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            ) : null}
            {count > 0 ? (
              <span className="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {count}
              </span>
            ) : null}
          </CardTitle>
          <CardDescription className="text-xs">
            {isMember ? "Your booking is marked in flight" : "Aircraft currently in the air"}
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-xs">
          <Link href={isMember ? "/bookings" : "/bookings?tab=flying"}>
            {isMember ? "My bookings" : "Bookings"} <IconChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="pt-0">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <IconNavigation className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">No active flights</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isMember ? "You don’t have a flight in progress." : "Nothing is marked as flying right now."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border">
            {bookings.map((booking) => {
              const href = getBookingOpenPath(booking.id, booking.status)
              const studentName = formatUser(booking.student)
              const aircraft = booking.aircraft?.registration ?? "No aircraft"
              const instructor = formatInstructor(booking.instructor)
              const progress = getFlightProgress({
                startIso: booking.start_time,
                endIso: booking.end_time,
                nowIso,
              })
              const overdue = progress?.overdue ?? false

              const accentRail = overdue
                ? "bg-rose-500"
                : "bg-emerald-500"
              const planeBg = overdue
                ? "bg-rose-500/10"
                : "bg-emerald-500/10"
              const planeColor = overdue ? "text-rose-600" : "text-emerald-600"
              const dueBadge = overdue
                ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              const progressFill = overdue ? "bg-rose-500" : "bg-emerald-500"
              const progressPercent = progress
                ? overdue
                  ? 100
                  : progress.percent
                : 0

              return (
                <li key={booking.id} className="relative">
                  <Link
                    href={href}
                    className="group block bg-card transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-stretch gap-3 px-3 py-2.5">
                      <div className={cn("w-1 shrink-0 rounded-full", accentRail)} aria-hidden />

                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full",
                          planeBg
                        )}
                      >
                        <IconPlane className={cn("h-[18px] w-[18px]", planeColor)} />
                      </div>

                      <div className="min-w-0 flex-1 self-center">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-foreground">{aircraft}</span>
                          {!isMember ? (
                            <span className="truncate text-sm text-foreground/80">
                              {studentName}
                            </span>
                          ) : null}
                          {instructor ? (
                            <span className="truncate text-xs text-muted-foreground">
                              · {instructor}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                          <span>
                            {formatTime(booking.start_time, timeZone)} – {formatTime(booking.end_time, timeZone)}
                          </span>
                          {progress ? (
                            <>
                              <span aria-hidden>·</span>
                              <span>{formatDuration(progress.totalMinutes)} sched</span>
                              {!overdue ? (
                                <>
                                  <span aria-hidden>·</span>
                                  <span>{formatDuration(progress.elapsedMinutes)} elapsed</span>
                                </>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 self-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide",
                            dueBadge
                          )}
                        >
                          {progress ? formatRemaining(progress) : "In flight"}
                        </span>
                        <IconChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
                      </div>
                    </div>

                    <div
                      className="h-1 w-full bg-muted/70"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progressPercent)}
                      aria-label={`${Math.round(progressPercent)}% of scheduled flight elapsed`}
                    >
                      <div
                        className={cn("h-full transition-all", progressFill)}
                        style={{ width: `${progressPercent}%` }}
                      />
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
