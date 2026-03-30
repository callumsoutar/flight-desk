"use client"

import * as React from "react"
import Link from "next/link"
import { IconCheck, IconChevronRight, IconClipboardList, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"

import { updateBookingStatusAction } from "@/app/bookings/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { DashboardBookingLite } from "@/lib/types/dashboard"
import { cn } from "@/lib/utils"

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
    const userName = [instructor.user.first_name, instructor.user.last_name].filter(Boolean).join(" ").trim()
    if (userName) return userName
    return instructor.user.email
  }
  return null
}

function formatAircraftDetail(aircraft: DashboardBookingLite["aircraft"]) {
  if (!aircraft) return null
  const parts = [aircraft.registration, aircraft.manufacturer, aircraft.model].filter(Boolean)
  return parts.join(" · ") || null
}

function formatBookingType(type: string) {
  if (type === "flight") return "Flight"
  if (type === "groundwork") return "Ground"
  if (type === "maintenance") return "Maintenance"
  return type.charAt(0).toUpperCase() + type.slice(1)
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

function formatShortDate(value: string, timeZone: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(date)
}

export function BookingRequestsCard({
  bookings,
  timeZone,
  allowConfirmActions = true,
}: {
  bookings: DashboardBookingLite[]
  timeZone: string
  /** Staff can confirm requests; members only review. */
  allowConfirmActions?: boolean
}) {
  const [rows, setRows] = React.useState(bookings)
  const [pendingId, setPendingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    setRows(bookings)
  }, [bookings])

  const count = rows.length

  const approve = async (bookingId: string) => {
    if (pendingId) return

    setPendingId(bookingId)
    const MIN_VISIBLE_LOADING_MS = 900
    const loadingDelay = new Promise((resolve) => setTimeout(resolve, MIN_VISIBLE_LOADING_MS))
    const result = await updateBookingStatusAction(bookingId, "confirmed")
    await loadingDelay

    setPendingId(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success("Booking confirmed")
    setRows((current) => current.filter((booking) => booking.id !== bookingId))
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            {allowConfirmActions ? "Booking requests" : "Your booking requests"}
            {count > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-5 rounded-full px-1.5 text-[10px] font-semibold">
                {count}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            {allowConfirmActions ? "Requests awaiting confirmation" : "Awaiting confirmation from the school"}
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-xs">
          <Link href={allowConfirmActions ? "/bookings?tab=unconfirmed" : "/bookings"}>
            View all <IconChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent>
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <IconClipboardList className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">No pending requests</p>
            <p className="mt-1 text-sm text-muted-foreground">You&apos;re all caught up.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((booking) => {
              const studentName = formatUser(booking.student)
              const aircraft = booking.aircraft?.registration ?? "No aircraft"
              const instructor = formatInstructor(booking.instructor)
              const aircraftDetail = formatAircraftDetail(booking.aircraft)
              const bookingType = formatBookingType(booking.booking_type)
              const when = `${formatShortDate(booking.start_time, timeZone)}, ${formatTime(booking.start_time, timeZone)}–${formatTime(booking.end_time, timeZone)}`
              const isApproving = pendingId === booking.id

              return (
                <article
                  key={booking.id}
                  className="rounded-xl border border-border/70 bg-card px-4 py-4 sm:px-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground">{studentName}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-muted px-2.5 py-1">{aircraft}</span>
                        <span className="rounded-full bg-muted px-2.5 py-1">{bookingType}</span>
                        <span className="rounded-full bg-muted px-2.5 py-1 tabular-nums">{when}</span>
                      </div>
                    </div>
                    {!allowConfirmActions ? (
                      <Badge variant="secondary" className="shrink-0 rounded-full px-2.5 py-1 text-[11px]">
                        Pending
                      </Badge>
                    ) : null}
                  </div>

                  {allowConfirmActions && (instructor || aircraftDetail) ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {instructor ? `Instructor: ${instructor}` : null}
                      {instructor && aircraftDetail ? "  ·  " : null}
                      {aircraftDetail ? `Aircraft: ${aircraftDetail}` : null}
                    </p>
                  ) : null}

                  {booking.purpose ? (
                    <p className="mt-3 rounded-md border border-border/60 bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
                      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/75">Purpose:</span>
                      {booking.purpose}
                    </p>
                  ) : null}

                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                    {allowConfirmActions && isApproving ? (
                      <p className="mr-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                        Confirming...
                      </p>
                    ) : null}

                    <Button
                      variant={allowConfirmActions ? "outline" : "default"}
                      size="sm"
                      className={cn(
                        "h-8 px-3 text-xs",
                        allowConfirmActions && isApproving ? "pointer-events-none opacity-60" : ""
                      )}
                      asChild
                    >
                      <Link href={`/bookings/${booking.id}`}>
                        {allowConfirmActions ? "Review details" : "View booking"}
                      </Link>
                    </Button>

                    {allowConfirmActions ? (
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 bg-emerald-600 px-4 text-xs text-white hover:bg-emerald-700"
                        disabled={!!isApproving}
                        onClick={() => approve(booking.id)}
                      >
                        {isApproving ? (
                          <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <IconCheck className="h-3.5 w-3.5" />
                        )}
                        Confirm
                      </Button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
