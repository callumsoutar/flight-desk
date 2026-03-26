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
    <Card className="border border-border/50 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
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
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <Link href="/bookings?tab=unconfirmed">
              View all <IconChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {count === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
              <IconClipboardList className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No pending requests</p>
            <p className="mt-1 text-xs text-muted-foreground">You&apos;re all caught up.</p>
          </div>
        ) : (
          <TooltipProvider delayDuration={300}>
            <div className="divide-y divide-border/50">
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
                    className="py-2.5 first:pt-0 last:pb-0"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-default">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-foreground">{studentName}</p>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "h-7 px-3 text-[11px]",
                                  isApproving ? "pointer-events-none opacity-60" : ""
                                )}
                                asChild
                              >
                                <Link href={`/bookings/${booking.id}`}>Review</Link>
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 gap-1.5 bg-emerald-600 px-3 text-[11px] text-white hover:bg-emerald-700"
                                disabled={!!isApproving}
                                onClick={() => approve(booking.id)}
                              >
                                {isApproving ? (
                                  <>
                                    <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                                    Confirming
                                  </>
                                ) : (
                                  <>
                                    <IconCheck className="h-3 w-3" />
                                    Confirm
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{aircraft}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span>{bookingType}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="tabular-nums">
                              {formatShortDate(booking.start_time, timeZone)}, {formatTime(booking.start_time, timeZone)}–{formatTime(booking.end_time, timeZone)}
                            </span>
                          </div>
                          {booking.purpose && (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                              <span className="font-medium text-muted-foreground/70">Purpose:</span> {booking.purpose}
                            </p>
                          )}
                          {isApproving ? (
                            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                              <IconLoader2 className="h-3 w-3 animate-spin" />
                              Applying confirmation...
                            </p>
                          ) : null}
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
