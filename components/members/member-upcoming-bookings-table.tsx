"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import {
  IconCalendar,
  IconChevronRight,
  IconPlane,
  IconSchool,
} from "@tabler/icons-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { BookingStatus, BookingWithRelations } from "@/lib/types/bookings"

export type MemberUpcomingBookingsTableProps = {
  memberId: string
}

const FUTURE_STATUSES: BookingStatus[] = ["unconfirmed", "confirmed", "briefing", "flying"]

function formatDate(value: string) {
  const date = new Date(value)
  return date.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatTime(value: string) {
  const date = new Date(value)
  return date.toLocaleTimeString("en-NZ", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function getInstructorName(booking: BookingWithRelations): string {
  if (!booking.instructor) return "Solo"
  const firstName = booking.instructor.user?.first_name ?? booking.instructor.first_name ?? ""
  const lastName = booking.instructor.user?.last_name ?? booking.instructor.last_name ?? ""
  const fullName = `${firstName} ${lastName}`.trim()
  return fullName || booking.instructor.user?.email || "Solo"
}

function getStatusBadge(status: BookingStatus) {
  switch (status) {
    case "unconfirmed":
      return (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
          Unconfirmed
        </Badge>
      )
    case "confirmed":
      return (
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
          Confirmed
        </Badge>
      )
    case "briefing":
      return (
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          Briefing
        </Badge>
      )
    case "flying":
      return (
        <Badge
          variant="outline"
          className="animate-pulse border-indigo-200 bg-indigo-50 text-indigo-700"
        >
          Flying
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

async function fetchMemberUpcomingBookings(memberId: string): Promise<BookingWithRelations[]> {
  const statusQuery = FUTURE_STATUSES.join(",")
  const response = await fetch(`/api/bookings?user_id=${memberId}&status=${statusQuery}`, {
    method: "GET",
    cache: "no-store",
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load upcoming bookings")
  }

  return (payload.bookings || []) as BookingWithRelations[]
}

export function MemberUpcomingBookingsTable({ memberId }: MemberUpcomingBookingsTableProps) {
  const [bookings, setBookings] = React.useState<BookingWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function loadBookings() {
      if (!memberId) {
        setBookings([])
        setIsLoading(false)
        setError(null)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const result = await fetchMemberUpcomingBookings(memberId)
        if (cancelled) return
        setBookings(result)
      } catch (err) {
        if (cancelled) return
        setBookings([])
        setError(err instanceof Error ? err.message : "Failed to load upcoming bookings")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadBookings()
    return () => {
      cancelled = true
    }
  }, [memberId])

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading upcoming bookings...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="text-destructive">{error}</div>
      </div>
    )
  }

  const now = Date.now()
  const upcomingBookings = bookings
    .filter((booking) => new Date(booking.end_time).getTime() >= now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  if (upcomingBookings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <IconCalendar className="h-6 w-6 text-slate-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-900">No upcoming bookings</h3>
        <p className="mx-auto mt-1 max-w-[220px] text-xs text-slate-500">
          This member has no scheduled flights or groundwork sessions.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Date & Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Aircraft / Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Instructor
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Purpose
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {upcomingBookings.map((booking) => {
              const aircraftLabel = booking.aircraft?.registration || "No Aircraft"
              const instructorName = getInstructorName(booking)

              return (
                <tr key={booking.id} className="group transition-colors hover:bg-slate-50/50">
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{formatDate(booking.start_time)}</span>
                      <span className="text-xs text-slate-500">
                        {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <IconPlane className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="font-semibold text-slate-900">{aircraftLabel}</div>
                        <div className="text-xs capitalize text-slate-500">{booking.booking_type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <IconSchool className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-700">{instructorName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="block max-w-[180px] truncate text-slate-600" title={booking.purpose ?? undefined}>
                      {booking.purpose || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">{getStatusBadge(booking.status)}</td>
                  <td className="px-4 py-3.5 text-right">
                    <Button variant="outline" size="sm" asChild className="h-8">
                      <Link href={`/bookings/${booking.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {upcomingBookings.map((booking) => {
          const aircraftLabel = booking.aircraft?.registration || "No Aircraft"
          const instructorName = getInstructorName(booking)

          return (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}`}
              className="relative block overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
            >
              <div
                className={cn(
                  "absolute top-0 bottom-0 left-0 w-1",
                  booking.status === "confirmed"
                    ? "bg-green-500"
                    : booking.status === "flying"
                      ? "bg-indigo-500"
                      : "bg-amber-500"
                )}
              />

              <div className="mb-2 flex items-start justify-between pl-2">
                <div>
                  <div className="flex items-center gap-2">
                    <IconPlane className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold text-slate-900">{aircraftLabel}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{booking.purpose || booking.booking_type}</div>
                </div>
                {getStatusBadge(booking.status)}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4 pl-2">
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Date & Time
                  </div>
                  <div className="text-xs font-medium text-slate-900">
                    {formatDate(booking.start_time)} @ {formatTime(booking.start_time)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Instructor
                  </div>
                  <div className="truncate text-xs font-medium text-slate-700">{instructorName}</div>
                </div>
              </div>

              <div className="absolute right-4 bottom-4">
                <IconChevronRight className="h-4 w-4 text-slate-300" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
