"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconCalendarEvent,
  IconChevronRight,
  IconClipboardList,
  IconHeart,
  IconPlane,
} from "@tabler/icons-react"

import { BookingStatusBadge } from "@/components/dashboard/booking-status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getBookingOpenPath } from "@/lib/bookings/navigation"
import { cn } from "@/lib/utils"
import type { DashboardBookingLite, DashboardData, DashboardMemberCompliance } from "@/lib/types/dashboard"

function formatLongDate(nowIso: string, timeZone: string) {
  const date = new Date(nowIso)
  if (Number.isNaN(date.getTime())) return "Today"
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function formatShortBookingDay(iso: string, timeZone: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date)
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

function zonedDateKey(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}

function formatInstructor(instructor: DashboardBookingLite["instructor"]) {
  if (!instructor) return "—"
  const name = [instructor.first_name, instructor.last_name].filter(Boolean).join(" ").trim()
  if (name) return name
  if (instructor.user) {
    const u = [instructor.user.first_name, instructor.user.last_name].filter(Boolean).join(" ").trim()
    if (u) return u
    return instructor.user.email
  }
  return "—"
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

function formatDisplayDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d)
}

type ExpiryPresentation = {
  label: string
  tone: "muted" | "ok" | "warn" | "bad"
}

function getExpiryPresentation(expiryDate: string | null | undefined): ExpiryPresentation {
  if (!expiryDate) {
    return { label: "Not on file", tone: "muted" }
  }

  const expiry = new Date(expiryDate)
  const today = new Date()
  const warningDate = new Date(today)
  warningDate.setDate(today.getDate() + 30)

  if (expiry < today) {
    return { label: formatDisplayDate(expiryDate), tone: "bad" }
  }
  if (expiry < warningDate) {
    return { label: formatDisplayDate(expiryDate), tone: "warn" }
  }
  return { label: formatDisplayDate(expiryDate), tone: "ok" }
}

function toneClass(tone: ExpiryPresentation["tone"]) {
  switch (tone) {
    case "bad":
      return "text-red-700 dark:text-red-400"
    case "warn":
      return "text-amber-700 dark:text-amber-400"
    case "ok":
      return "text-foreground"
    default:
      return "text-muted-foreground"
  }
}

function currencyTileSurface(tone: ExpiryPresentation["tone"]) {
  switch (tone) {
    case "bad":
      return "border-red-200/90 bg-red-50/80 dark:border-red-900/45 dark:bg-red-950/25"
    case "warn":
      return "border-amber-200/90 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20"
    case "ok":
      return "border-border/80 bg-muted/30 dark:bg-muted/15"
    default:
      return "border-border/80 bg-muted/25 dark:bg-muted/10"
  }
}

function PilotCurrencyTiles({ compliance }: { compliance: DashboardMemberCompliance }) {
  const medical = getExpiryPresentation(compliance.medicalDue)
  const bfr = getExpiryPresentation(compliance.bfrDue)

  return (
    <div className="grid gap-3">
      <div
        className={cn(
          "rounded-lg border p-3.5 transition-colors sm:p-4",
          currencyTileSurface(medical.tone)
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background/80 shadow-sm ring-1 ring-border/60 dark:bg-background/40">
            <IconHeart className="h-4 w-4 text-rose-500" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-medium leading-none text-muted-foreground">Medical certificate</p>
            <p className={cn("text-lg font-semibold leading-tight tracking-tight tabular-nums", toneClass(medical.tone))}>
              {medical.label}
            </p>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg border p-3.5 transition-colors sm:p-4",
          currencyTileSurface(bfr.tone)
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background/80 shadow-sm ring-1 ring-border/60 dark:bg-background/40">
            <IconCalendarEvent className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-medium leading-none text-muted-foreground">BFR (flight review)</p>
            <p className={cn("text-lg font-semibold leading-tight tracking-tight tabular-nums", toneClass(bfr.tone))}>
              {bfr.label}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MemberDashboard({ data }: { data: DashboardData }) {
  const dateLabel = React.useMemo(
    () => formatLongDate(data.nowIso, data.timeZone),
    [data.nowIso, data.timeZone]
  )

  const todayKey = zonedDateKey(data.nowIso, data.timeZone)
  const hasCompliance = Boolean(data.memberCompliance)
  const requestCount = data.bookingRequests.length

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 pb-8">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {data.tenantName}
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-6">
        {data.memberCompliance ? (
          <div className="min-w-0 xl:col-span-4">
            <Card className="h-full gap-0 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="space-y-1 pr-2">
                  <CardTitle className="text-base font-semibold">Pilot currency</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    Medical and flight review dates from your profile
                  </CardDescription>
                </div>
                <IconPlane className="h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
              </CardHeader>
              <CardContent className="pb-6 pt-0">
                <PilotCurrencyTiles compliance={data.memberCompliance} />
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className={cn("min-w-0", hasCompliance ? "xl:col-span-8" : "xl:col-span-12")}>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">Upcoming bookings</CardTitle>
                <CardDescription className="text-xs">Confirmed and in progress</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="h-8 shrink-0 gap-1 text-xs">
                <Link href="/bookings">
                  View all <IconChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="p-0 pt-0">
              {data.upcomingBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50 mx-6 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <IconCalendarEvent className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-sm font-medium">No upcoming bookings</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nothing confirmed on your schedule yet.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[9rem] pl-6 text-xs font-medium text-muted-foreground">
                        When
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Aircraft</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">
                        Instructor
                      </TableHead>
                      <TableHead className="pr-6 text-right text-xs font-medium text-muted-foreground">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.upcomingBookings.map((booking) => {
                      const aircraft = booking.aircraft?.registration ?? "—"
                      const instructor = formatInstructor(booking.instructor)
                      const href = getBookingOpenPath(booking.id, booking.status)
                      const startKey = zonedDateKey(booking.start_time, data.timeZone)
                      const showDay = startKey !== todayKey
                      const whenLabel = showDay
                        ? `${formatShortBookingDay(booking.start_time, data.timeZone)} · ${formatTime(booking.start_time, data.timeZone)}–${formatTime(booking.end_time, data.timeZone)}`
                        : `${formatTime(booking.start_time, data.timeZone)}–${formatTime(booking.end_time, data.timeZone)}`

                      return (
                        <TableRow key={booking.id} className="group">
                          <TableCell className="max-w-[11rem] pl-6 align-top">
                            <Link
                              href={href}
                              className="block font-medium tabular-nums text-foreground underline-offset-4 hover:underline"
                            >
                              {whenLabel}
                            </Link>
                            <p className="mt-1 text-xs text-muted-foreground sm:hidden">{instructor}</p>
                          </TableCell>
                          <TableCell className="align-top font-medium text-foreground">
                            <Link href={href} className="block underline-offset-4 hover:underline">
                              {aircraft}
                            </Link>
                          </TableCell>
                          <TableCell className="hidden max-w-[12rem] align-top text-muted-foreground sm:table-cell">
                            <Link href={href} className="block truncate underline-offset-4 hover:underline">
                              {instructor}
                            </Link>
                          </TableCell>
                          <TableCell className="pr-6 text-right align-top">
                            <Link href={href} className="inline-flex justify-end">
                              <BookingStatusBadge status={booking.status} />
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base font-semibold">
              Booking requests
              {requestCount > 0 ? (
                <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px] font-semibold">
                  {requestCount}
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription className="text-xs">Awaiting confirmation from the school</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="h-8 shrink-0 gap-1 text-xs">
            <Link href="/bookings">
              View all <IconChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="p-0 pt-0">
          {requestCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50 mx-6 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <IconClipboardList className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-medium">No pending requests</p>
              <p className="mt-1 text-sm text-muted-foreground">You&apos;re all caught up.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[10rem] pl-6 text-xs font-medium text-muted-foreground">
                    When
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Aircraft</TableHead>
                  <TableHead className="pr-6 text-right text-xs font-medium text-muted-foreground">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bookingRequests.map((booking) => {
                  const aircraft = booking.aircraft?.registration ?? "—"
                  const when = `${formatShortDate(booking.start_time, data.timeZone)} · ${formatTime(booking.start_time, data.timeZone)}–${formatTime(booking.end_time, data.timeZone)}`

                  return (
                    <TableRow key={booking.id}>
                      <TableCell className="max-w-[12rem] pl-6 align-top">
                        <span className="block font-medium tabular-nums text-foreground">{when}</span>
                      </TableCell>
                      <TableCell className="align-top font-medium text-foreground">{aircraft}</TableCell>
                      <TableCell className="pr-6 text-right align-top">
                        <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                          <Link href={`/bookings/${booking.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
