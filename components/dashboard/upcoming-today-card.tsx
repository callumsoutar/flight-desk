"use client"

import * as React from "react"
import Link from "next/link"
import { IconCalendarEvent, IconChevronRight, IconPlane } from "@tabler/icons-react"

import { BookingStatusBadge } from "@/components/dashboard/booking-status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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

      <CardContent className="pb-2">
        {bookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
              <IconCalendarEvent className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No upcoming bookings</p>
            <p className="mt-1 text-xs text-muted-foreground">Nothing scheduled for the rest of today.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border/60 bg-muted/30 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <div>Flight</div>
              <div className="text-right">Time</div>
              <div className="text-right">Actions</div>
            </div>

            {bookings.map((booking) => {
              const studentName = formatUser(booking.student)
              const aircraft = booking.aircraft?.registration ?? "No aircraft"
              const href = getBookingOpenPath(booking.id, booking.status)

              return (
                <div
                  key={booking.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border/50 px-4 py-2 last:border-0 hover:bg-muted/20"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/40">
                      <IconPlane className="h-3 w-3 text-muted-foreground" />
                    </span>
                    <p className="truncate text-sm font-medium text-foreground">
                      {studentName}
                      <span className="ml-1.5 text-muted-foreground">·</span>
                      <span className="ml-1 truncate text-xs text-muted-foreground">{aircraft}</span>
                    </p>
                    <BookingStatusBadge status={booking.status} className="shrink-0" />
                  </div>

                  <div className="flex items-center justify-end">
                    <span className="text-xs tabular-nums text-foreground">
                      {formatTime(booking.start_time, timeZone)}–{formatTime(booking.end_time, timeZone)}
                    </span>
                  </div>

                  <div className="flex items-center justify-end">
                    <Link
                      href={href}
                      className="text-xs font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
