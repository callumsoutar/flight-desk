"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconArrowLeft,
  IconCalendar,
  IconExternalLink,
  IconPlane,
  IconSchool,
  IconUser,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import type { BookingStatus, BookingWithRelations } from "@/lib/types/bookings"
import { cn } from "@/lib/utils"

interface BookingHeaderProps {
  booking: BookingWithRelations
  title: string
  backHref: string
  backLabel?: string
  className?: string
  actions?: React.ReactNode
  extra?: React.ReactNode
}

function getStatusBadgeStyles(status: BookingStatus): string {
  switch (status) {
    case "flying":
      return "bg-orange-500 text-white border-orange-600 hover:bg-orange-600 shadow-sm"
    case "confirmed":
      return "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 shadow-sm"
    case "unconfirmed":
      return "bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-sm"
    case "briefing":
      return "bg-violet-600 text-white border-violet-700 hover:bg-violet-700 shadow-sm"
    case "complete":
      return "bg-green-600 text-white border-green-700 hover:bg-green-700 shadow-sm"
    case "cancelled":
      return "bg-red-600 text-white border-red-700 hover:bg-red-700 shadow-sm"
    default:
      return "bg-slate-500 text-white border-slate-600 shadow-sm"
  }
}

function getStatusLabel(status: BookingStatus) {
  switch (status) {
    case "confirmed":
      return "Confirmed"
    case "flying":
      return "Flying"
    case "briefing":
      return "Briefing"
    case "unconfirmed":
      return "Unconfirmed"
    case "complete":
      return "Complete"
    case "cancelled":
      return "Cancelled"
    default:
      return "Unknown"
  }
}

function formatDisplayName(user: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email
}

export function BookingHeader({
  booking,
  title,
  backHref,
  backLabel = "Back to Bookings",
  className,
  actions,
  extra,
}: BookingHeaderProps) {
  const status = booking.status
  const badgeLabel = getStatusLabel(status)
  const badgeStyles = getStatusBadgeStyles(status)

  const studentName = booking.student ? formatDisplayName(booking.student) : null

  const instructorName = booking.instructor
    ? formatDisplayName({
        first_name: booking.instructor.user?.first_name ?? booking.instructor.first_name,
        last_name: booking.instructor.user?.last_name ?? booking.instructor.last_name,
        email: booking.instructor.user?.email ?? null,
      })
    : null

  const aircraftLabel = booking.aircraft?.registration || "TBD"

  const dateLabel = booking.start_time
    ? new Date(booking.start_time).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "TBD"

  return (
    <div className={cn("border-b border-border/40 bg-background py-4 sm:py-6", className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
          <Link
            href={backHref}
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <IconArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            {backLabel}
          </Link>

          <div className="flex items-center gap-2">
            {extra}
            <Badge
              className={cn(
                "rounded-full border-none px-2.5 py-1 text-xs font-bold uppercase tracking-wider shadow-sm sm:px-3",
                badgeStyles,
                status === "flying" && "animate-pulse"
              )}
            >
              {status === "flying" ? <IconPlane className="mr-1.5 inline h-3 w-3 sm:h-3.5 sm:w-3.5" /> : null}
              {badgeLabel}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3 sm:space-y-4">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {studentName && booking.user_id ? (
                <div className="flex items-center gap-1.5">
                  <IconUser className="h-4 w-4" />
                  <span className="font-medium text-foreground/70">Member:</span>
                  <Link
                    href={`/members/${booking.user_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {studentName}
                    <IconExternalLink className="h-3 w-3 opacity-40" />
                  </Link>
                </div>
              ) : null}

              {instructorName ? (
                <div className="flex items-center gap-1.5">
                  <IconSchool className="h-4 w-4" />
                  <span className="font-medium text-foreground/70">Instructor:</span>
                  <span className="font-semibold text-foreground">{instructorName}</span>
                </div>
              ) : null}

              <div className="flex items-center gap-1.5">
                <IconPlane className="h-4 w-4" />
                <span className="font-medium text-foreground/70">Aircraft:</span>
                {booking.aircraft_id ? (
                  <Link
                    href={`/aircraft/${booking.aircraft_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {aircraftLabel}
                    <IconExternalLink className="h-3 w-3 opacity-40" />
                  </Link>
                ) : (
                  <span className="font-semibold text-foreground">{aircraftLabel}</span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <IconCalendar className="h-4 w-4" />
                <span className="font-medium text-foreground/70">Date:</span>
                <span className="font-semibold text-foreground">{dateLabel}</span>
              </div>
            </div>
          </div>

          {actions ? (
            <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:pl-4">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
