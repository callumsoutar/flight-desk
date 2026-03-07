"use client"

import * as React from "react"
import Link from "next/link"
import { IconChevronRight, IconNavigation, IconPlane, IconRocket } from "@tabler/icons-react"

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

function formatEta({
  endIso,
  nowIso,
  timeZone,
}: {
  endIso: string
  nowIso: string
  timeZone: string
}) {
  const end = new Date(endIso).getTime()
  const now = new Date(nowIso).getTime()
  if (!Number.isFinite(end) || !Number.isFinite(now)) return { label: "—", overdue: false }
  const overdue = end < now
  return { label: formatTime(endIso, timeZone), overdue }
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
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <span className="bg-muted/50 flex h-8 w-8 items-center justify-center rounded-lg">
                <IconRocket className="h-4 w-4 text-muted-foreground" />
              </span>
              Flying now
            </CardTitle>
            <CardDescription>Bookings currently in the air.</CardDescription>
          </div>

          <Button asChild variant="ghost" size="sm" className="h-8 gap-1">
            <Link href="/bookings?tab=flying">
              Bookings <IconChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        {bookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
              <IconNavigation className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No active flights</p>
            <p className="mt-1 text-xs text-muted-foreground">Nothing is marked as flying right now.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border/60 bg-muted/30 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <div>Flight</div>
              <div className="text-right">Time</div>
              <div className="text-right">Actions</div>
            </div>

            {bookings.map((booking) => {
              const href = getBookingOpenPath(booking.id, booking.status)
              const studentName = formatUser(booking.student)
              const aircraft = booking.aircraft?.registration ?? "No aircraft"
              const status = formatStatus({ endIso: booking.end_time, nowIso })
              const eta = formatEta({ endIso: booking.end_time, nowIso, timeZone })

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
                  </div>

                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-xs tabular-nums text-foreground">
                      {formatTime(booking.start_time, timeZone)}–{eta.label}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] tabular-nums",
                        status.overdue ? "text-rose-600" : "text-muted-foreground"
                      )}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-end">
                    <Link
                      href={href}
                      className="text-xs font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
                    >
                      Check in
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
