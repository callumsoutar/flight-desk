"use client"

import * as React from "react"
import Link from "next/link"
import { IconCalendarEvent, IconChevronRight } from "@tabler/icons-react"

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
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">Today&apos;s schedule</CardTitle>
            <CardDescription className="text-xs">Upcoming bookings for the rest of today</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <Link href="/scheduler">
              Scheduler <IconChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {bookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
              <IconCalendarEvent className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No upcoming bookings</p>
            <p className="mt-1 text-xs text-muted-foreground">Nothing scheduled for the rest of today.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {bookings.map((booking) => {
              const studentName = formatUser(booking.student)
              const aircraft = booking.aircraft?.registration ?? "No aircraft"
              const href = getBookingOpenPath(booking.id, booking.status)

              return (
                <Link
                  key={booking.id}
                  href={href}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <span className="w-[100px] shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {formatTime(booking.start_time, timeZone)} – {formatTime(booking.end_time, timeZone)}
                  </span>
                  <span className="h-4 w-px shrink-0 bg-border/70" />
                  <p className="min-w-0 truncate text-sm font-medium text-foreground">{studentName}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{aircraft}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <BookingStatusBadge status={booking.status} className="shrink-0" />
                    <IconChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
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
