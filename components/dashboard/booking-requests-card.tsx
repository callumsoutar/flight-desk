"use client"

import * as React from "react"
import Link from "next/link"
import { IconCheck, IconChevronRight, IconClipboardList, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"

import { updateBookingStatusAction } from "@/app/bookings/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
}: {
  bookings: DashboardBookingLite[]
  timeZone: string
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
            Booking requests
            {count > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-5 rounded-full px-1.5 text-[10px] font-semibold">
                {count}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">Requests awaiting confirmation</CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-xs">
          <Link href="/bookings?tab=unconfirmed">
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
          <TooltipProvider delayDuration={300}>
            <div className="space-y-3">
              {rows.map((booking) => {
                const studentName = formatUser(booking.student)
                const aircraft = booking.aircraft?.registration ?? "No aircraft"
                const instructor = formatInstructor(booking.instructor)
                const aircraftDetail = formatAircraftDetail(booking.aircraft)
                const bookingType = formatBookingType(booking.booking_type)
                const isApproving = pendingId === booking.id

                return (
                  <div
                    key={booking.id}
                    className="rounded-lg border p-4 shadow-sm transition-all"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-default">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground">{studentName}</span>
                              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span>{aircraft}</span>
                                <span className="text-muted-foreground/40">·</span>
                                <span>{bookingType}</span>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="tabular-nums">
                                  {formatShortDate(booking.start_time, timeZone)}, {formatTime(booking.start_time, timeZone)}–{formatTime(booking.end_time, timeZone)}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {booking.purpose && (
                            <p className="mt-3 line-clamp-2 text-sm text-muted-foreground bg-muted/30 rounded-md p-2 border border-border/50">
                              <span className="font-medium text-foreground/70 text-xs uppercase tracking-wider mr-1">Purpose:</span> 
                              {booking.purpose}
                            </p>
                          )}
                          
                          <div className="mt-4 flex items-center justify-end gap-2">
                            {isApproving ? (
                              <p className="mr-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                                Confirming...
                              </p>
                            ) : null}
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-8 px-3 text-xs",
                                isApproving ? "pointer-events-none opacity-60" : ""
                              )}
                              asChild
                            >
                              <Link href={`/bookings/${booking.id}`}>Review details</Link>
                            </Button>
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
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        variant="card"
                        side="left"
                        sideOffset={8}
                        className="w-64 p-3"
                      >
                        <div className="space-y-1.5 text-xs">
                          <p className="font-medium text-foreground">{studentName}</p>
                          {instructor && (
                            <p><span className="text-muted-foreground">Instructor:</span> {instructor}</p>
                          )}
                          {aircraftDetail && (
                            <p><span className="text-muted-foreground">Aircraft:</span> {aircraftDetail}</p>
                          )}
                          <p><span className="text-muted-foreground">Type:</span> {bookingType}</p>
                          <p>
                            <span className="text-muted-foreground">When:</span>{" "}
                            {formatShortDate(booking.start_time, timeZone)}, {formatTime(booking.start_time, timeZone)}–{formatTime(booking.end_time, timeZone)}
                          </p>
                          {booking.purpose && (
                            <p><span className="text-muted-foreground">Purpose:</span> {booking.purpose}</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  )
}
