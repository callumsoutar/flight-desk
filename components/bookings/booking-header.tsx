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

import { useTimezone } from "@/contexts/timezone-context"
import type { BookingStatus, BookingWithRelations } from "@/lib/types/bookings"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/date-format"

interface BookingHeaderProps {
  booking: BookingWithRelations
  title: string
  backHref: string
  backLabel?: string
  className?: string
  actions?: React.ReactNode
  extra?: React.ReactNode
  /** When false, member and aircraft names are plain text (no links to records). */
  showRecordLinks?: boolean
}

type FlightInstructionType = NonNullable<BookingWithRelations["flight_type"]>["instruction_type"]

type BookingHeaderIndicatorTone = "blue" | "green" | "amber" | "orange" | "rose" | "slate" | "violet"

function getIndicatorToneClasses(tone: BookingHeaderIndicatorTone) {
  switch (tone) {
    case "blue":
      return {
        dot: "bg-blue-500",
      }
    case "green":
      return {
        dot: "bg-emerald-500",
      }
    case "amber":
      return {
        dot: "bg-amber-500",
      }
    case "orange":
      return {
        dot: "bg-orange-500",
      }
    case "rose":
      return {
        dot: "bg-rose-500",
      }
    case "violet":
      return {
        dot: "bg-violet-500",
      }
    default:
      return {
        dot: "bg-slate-400",
      }
  }
}

function getStatusIndicatorTone(status: BookingStatus): BookingHeaderIndicatorTone {
  switch (status) {
    case "flying":
      return "orange"
    case "confirmed":
      return "blue"
    case "unconfirmed":
      return "amber"
    case "briefing":
      return "violet"
    case "complete":
      return "green"
    case "cancelled":
      return "rose"
    default:
      return "slate"
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

function getInstructionTypeLabel(instructionType: FlightInstructionType) {
  switch (instructionType) {
    case "solo":
      return "Solo"
    case "dual":
      return "Dual"
    case "trial":
      return "Trial"
    default:
      return null
  }
}

function getInstructionBadgeStyles(instructionType: FlightInstructionType) {
  switch (instructionType) {
    case "solo":
      return "green"
    case "dual":
      return "blue"
    case "trial":
      return "violet"
    default:
      return "slate"
  }
}

function formatDisplayName(user: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email
}

export function BookingHeaderIndicator({
  label,
  value,
  tone = "slate",
  variant = "inline",
  className,
}: {
  label: string
  value: string
  tone?: BookingHeaderIndicatorTone
  variant?: "inline" | "status"
  className?: string
}) {
  const toneClasses = getIndicatorToneClasses(tone)

  return (
    <div
      className={cn(
        "inline-flex min-h-0 w-auto items-center gap-2.5 rounded-none border-0 bg-transparent px-0 py-0 shadow-none",
        className
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
        {label}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-medium text-foreground",
          variant === "status" ? "border-border/60 bg-background" : "border-border/50 bg-muted/20"
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", toneClasses.dot)} />
        <span className="truncate">{value}</span>
      </span>
    </div>
  )
}

export function BookingHeaderIndicators({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:w-auto sm:justify-end", className)}>
      {children}
    </div>
  )
}

export function BookingHeader({
  booking,
  title,
  backHref,
  backLabel = "Back to Bookings",
  className,
  actions,
  extra,
  showRecordLinks = true,
}: BookingHeaderProps) {
  const { timeZone } = useTimezone()
  const status = booking.status
  const isGroundwork = booking.booking_type === "groundwork"
  const badgeLabel = getStatusLabel(status)
  const statusTone = getStatusIndicatorTone(status)
  const instructionType = booking.booking_type === "flight" ? booking.flight_type?.instruction_type ?? null : null
  const instructionLabel = instructionType ? getInstructionTypeLabel(instructionType) : null
  const instructionTone = instructionType ? getInstructionBadgeStyles(instructionType) : null

  const studentName = booking.student ? formatDisplayName(booking.student) : null

  const instructorName = booking.instructor
    ? formatDisplayName({
        first_name: booking.instructor.user?.first_name ?? booking.instructor.first_name,
        last_name: booking.instructor.user?.last_name ?? booking.instructor.last_name,
        email: booking.instructor.user?.email ?? null,
      })
    : null

  const assetLabel = isGroundwork ? "Groundwork session" : booking.aircraft?.registration || "TBD"

  const dateLabel = formatDate(booking.start_time, timeZone) || "TBD"

  return (
    <div className={cn("border-b border-border/40 bg-background py-3 sm:py-4", className)}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={backHref}
            className="group inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <IconArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            {backLabel}
          </Link>

          <BookingHeaderIndicators className="sm:justify-end">
            {extra}
            {instructionType && instructionLabel && instructionTone ? (
              <BookingHeaderIndicator label="Type" value={instructionLabel} tone={instructionTone} />
            ) : null}
            <BookingHeaderIndicator label="Status" value={badgeLabel} tone={statusTone} variant="status" />
          </BookingHeaderIndicators>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-5">
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="max-w-4xl text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-[1.7rem]">
              {title}
            </h1>

            <div className="grid gap-x-5 gap-y-2 text-sm text-muted-foreground sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center">
              {studentName && booking.user_id ? (
                <div className="flex min-w-0 items-center gap-1.5">
                  <IconUser className="h-4 w-4" />
                  <span className="font-medium text-foreground/70">Member:</span>
                  {showRecordLinks ? (
                    <Link
                      href={`/members/${booking.user_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-foreground transition-colors hover:text-primary"
                    >
                      {studentName}
                      <IconExternalLink className="h-3 w-3 opacity-40" />
                    </Link>
                  ) : (
                    <span className="font-semibold text-foreground">{studentName}</span>
                  )}
                </div>
              ) : null}

              {instructorName ? (
                <div className="flex min-w-0 items-center gap-1.5">
                  <IconSchool className="h-4 w-4" />
                  <span className="font-medium text-foreground/70">Instructor:</span>
                  <span className="font-semibold text-foreground">{instructorName}</span>
                </div>
              ) : null}

              <div className="flex min-w-0 items-center gap-1.5">
                <IconPlane className="h-4 w-4" />
                <span className="font-medium text-foreground/70">{isGroundwork ? "Session:" : "Aircraft:"}</span>
                {!isGroundwork && booking.aircraft_id && showRecordLinks ? (
                  <Link
                    href={`/aircraft/${booking.aircraft_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {assetLabel}
                    <IconExternalLink className="h-3 w-3 opacity-40" />
                  </Link>
                ) : (
                  <span className="font-semibold text-foreground">{assetLabel}</span>
                )}
              </div>

              <div className="flex min-w-0 items-center gap-1.5">
                <IconCalendar className="h-4 w-4" />
                <span className="font-medium text-foreground/70">Date:</span>
                <span className="font-semibold text-foreground">{dateLabel}</span>
              </div>
            </div>
          </div>

          {actions ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end lg:self-start lg:pl-4">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
