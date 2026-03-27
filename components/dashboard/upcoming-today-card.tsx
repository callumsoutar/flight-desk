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
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">Today&apos;s schedule</CardTitle>
          <CardDescription className="text-xs">Upcoming bookings for the rest of today</CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-xs">
          <Link href="/scheduler">
            Scheduler <IconChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent>
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <IconCalendarEvent className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">No upcoming bookings</p>
            <p className="mt-1 text-sm text-muted-foreground">Nothing scheduled for the rest of today.</p>
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
                  className="group flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{studentName}</span>
                      <span className="text-xs text-muted-foreground">{aircraft}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium tabular-nums text-muted-foreground">
                      {formatTime(booking.start_time, timeZone)} – {formatTime(booking.end_time, timeZone)}
                    </span>
                    <BookingStatusBadge status={booking.status} className="shrink-0" />
                    <IconChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
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
