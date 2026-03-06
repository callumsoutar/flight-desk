"use client"

import * as React from "react"
import Link from "next/link"
import { IconCalendarEvent, IconChevronRight, IconPlane } from "@tabler/icons-react"

import { BookingStatusBadge } from "@/components/dashboard/booking-status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getBookingOpenPath } from "@/lib/bookings/navigation"
import type { DashboardBookingLite } from "@/lib/types/dashboard"

function formatUser(user: DashboardBookingLite["student"]) {
  if (!user) return "—"
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
  return name || user.email || "—"
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

function formatDay(value: string, timeZone: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "2-digit",
  }).format(date)
}

export function UpcomingTodayCard({
  bookings,
  timeZone,
}: {
  bookings: DashboardBookingLite[]
  timeZone: string
}) {
  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <span className="bg-muted/50 flex h-8 w-8 items-center justify-center rounded-lg">
                <IconCalendarEvent className="h-4 w-4 text-muted-foreground" />
              </span>
              Today&apos;s schedule
            </CardTitle>
            <CardDescription>Upcoming bookings still on the board.</CardDescription>
          </div>

          <Button asChild variant="ghost" size="sm" className="h-8 gap-1">
            <Link href="/scheduler">
              Open scheduler <IconChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        {bookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
              <IconCalendarEvent className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No upcoming bookings</p>
            <p className="mt-1 text-xs text-muted-foreground">Nothing scheduled for the rest of today.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bookings.map((booking) => {
              const studentName = formatUser(booking.student)
              const aircraft = booking.aircraft?.registration ?? "No aircraft"
              const href = getBookingOpenPath(booking.id, booking.status)

              return (
                <Link
                  key={booking.id}
                  href={href}
                  className={cn(
                    "group block rounded-lg border border-border/60 bg-background p-2.5 shadow-sm transition-colors",
                    "hover:bg-muted/20 active:bg-muted/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{studentName}</p>
                        <BookingStatusBadge status={booking.status} className="hidden sm:inline-flex" />
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {booking.purpose || "—"}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <IconPlane className="h-4 w-4" />
                        <span className="truncate">{aircraft}</span>
                        <span className="text-muted-foreground/60">•</span>
                        <span className="truncate">{formatDay(booking.start_time, timeZone)}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                      <div className="text-sm font-semibold tabular-nums text-foreground">
                        {formatTime(booking.start_time, timeZone)}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {formatTime(booking.end_time, timeZone)}
                      </div>
                      <BookingStatusBadge status={booking.status} className="sm:hidden" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
