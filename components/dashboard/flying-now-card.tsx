"use client"

import * as React from "react"
import Link from "next/link"
import { IconChevronRight, IconNavigation, IconPlane } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

function formatStatus({
  endIso,
  nowIso,
}: {
  endIso: string
  nowIso: string
}) {
  const end = new Date(endIso).getTime()
  const now = new Date(nowIso).getTime()
  if (!Number.isFinite(end) || !Number.isFinite(now)) return { label: "—", overdue: false }
  const diffMinutes = Math.round((end - now) / 60000)
  const overdue = diffMinutes < 0
  const absMinutes = Math.abs(diffMinutes)

  if (absMinutes >= 1440) {
    const days = Math.round(absMinutes / 1440)
    return { label: `${overdue ? "Overdue" : "Due in"} ${days}d`, overdue }
  }

  const hours = Math.floor(absMinutes / 60)
  const mins = absMinutes % 60
  if (hours > 0) {
    return { label: `${overdue ? "Overdue" : "Due in"} ${hours}h ${mins}m`, overdue }
  }
  return { label: `${overdue ? "Overdue" : "Due in"} ${mins}m`, overdue }
}

export function FlyingNowCard({
  bookings,
  timeZone,
  nowIso,
}: {
  bookings: DashboardBookingLite[]
  timeZone: string
  nowIso: string
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            Flying now
            {bookings.length > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
          </CardTitle>
          <CardDescription className="text-xs">Aircraft currently in the air</CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-xs">
          <Link href="/bookings?tab=flying">
            Bookings <IconChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent>
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <IconNavigation className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">No active flights</p>
            <p className="mt-1 text-sm text-muted-foreground">Nothing is marked as flying right now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bookings.map((booking) => {
              const href = getBookingOpenPath(booking.id, booking.status)
              const studentName = formatUser(booking.student)
              const aircraft = booking.aircraft?.registration ?? "No aircraft"
              const status = formatStatus({ endIso: booking.end_time, nowIso })

              return (
                <Link
                  key={booking.id}
                  href={href}
                  className="group flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                      <IconPlane className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{studentName}</span>
                        <span className="text-xs text-muted-foreground">{aircraft}</span>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground mt-0.5">
                        {formatTime(booking.start_time, timeZone)} – {formatTime(booking.end_time, timeZone)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        status.overdue
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {status.label}
                    </span>
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
