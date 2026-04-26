"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconCheck,
  IconChevronRight,
  IconClipboardList,
  IconLoader2,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { updateBookingStatusAction } from "@/app/bookings/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
    const MIN_VISIBLE_LOADING_MS = 600
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

      <CardContent className="pt-0">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <IconClipboardList className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">No pending requests</p>
            <p className="mt-1 text-sm text-muted-foreground">You&apos;re all caught up.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-9 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {allowConfirmActions ? "Pilot" : "Booking"}
                  </TableHead>
                  <TableHead className="h-9 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Aircraft
                  </TableHead>
                  <TableHead className="h-9 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    When
                  </TableHead>
                  <TableHead className="h-9 w-px text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {allowConfirmActions ? "Action" : "Status"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((booking) => {
                  const studentName = formatUser(booking.student)
                  const aircraft = booking.aircraft?.registration ?? "—"
                  const instructor = formatInstructor(booking.instructor)
                  const aircraftDetail = formatAircraftDetail(booking.aircraft)
                  const bookingType = formatBookingType(booking.booking_type)
                  const dateLabel = formatShortDate(booking.start_time, timeZone)
                  const timeRange = `${formatTime(booking.start_time, timeZone)}–${formatTime(booking.end_time, timeZone)}`
                  const isApproving = pendingId === booking.id

                  return (
                    <HoverCard key={booking.id} openDelay={120} closeDelay={80}>
                      <HoverCardTrigger asChild>
                        <TableRow className="cursor-default">
                          <TableCell className="py-2.5 font-medium text-foreground">
                            <Link
                              href={`/bookings/${booking.id}`}
                              className="hover:underline underline-offset-2"
                            >
                              {studentName}
                            </Link>
                          </TableCell>
                          <TableCell className="py-2.5 text-sm text-muted-foreground">
                            {aircraft}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm tabular-nums text-muted-foreground">
                            <span className="text-foreground">{dateLabel}</span>
                            <span className="ml-1.5">{timeRange}</span>
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            {allowConfirmActions ? (
                              <Button
                                size="sm"
                                className={cn(
                                  "h-7 gap-1.5 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700",
                                  isApproving ? "pointer-events-none opacity-70" : ""
                                )}
                                disabled={!!isApproving}
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  approve(booking.id)
                                }}
                              >
                                {isApproving ? (
                                  <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <IconCheck className="h-3.5 w-3.5" />
                                )}
                                Confirm
                              </Button>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="rounded-full px-2 py-0.5 text-[11px]"
                              >
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      </HoverCardTrigger>

                      <HoverCardContent
                        align="start"
                        side="top"
                        sideOffset={6}
                        className="w-80 p-0"
                      >
                        <div className="space-y-3 p-4">
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-foreground">{studentName}</p>
                            <p className="text-xs text-muted-foreground">
                              {bookingType} · {dateLabel} {timeRange}
                            </p>
                          </div>

                          <dl className="grid grid-cols-[88px_1fr] gap-y-1.5 text-xs">
                            {aircraftDetail ? (
                              <>
                                <dt className="text-muted-foreground">Aircraft</dt>
                                <dd className="text-foreground">{aircraftDetail}</dd>
                              </>
                            ) : null}
                            {instructor ? (
                              <>
                                <dt className="text-muted-foreground">Instructor</dt>
                                <dd className="text-foreground">{instructor}</dd>
                              </>
                            ) : null}
                            {booking.purpose ? (
                              <>
                                <dt className="text-muted-foreground">Purpose</dt>
                                <dd className="text-foreground">{booking.purpose}</dd>
                              </>
                            ) : null}
                          </dl>

                          <div className="flex items-center justify-end border-t pt-2">
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                            >
                              <Link href={`/bookings/${booking.id}`}>
                                Review details
                                <IconChevronRight className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
