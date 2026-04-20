"use client"

import * as React from "react"
import Link from "next/link"
import { IconArrowLeft } from "@tabler/icons-react"

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

type BookingHeaderIndicatorTone =
  | "blue"
  | "green"
  | "amber"
  | "orange"
  | "rose"
  | "slate"
  | "violet"

type ToneClasses = {
  dot: string
  pulse: string
  badge: string
}

const TONE_STYLES: Record<BookingHeaderIndicatorTone, ToneClasses> = {
  blue: {
    dot: "bg-blue-500",
    pulse: "bg-blue-400",
    badge: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
  },
  green: {
    dot: "bg-emerald-500",
    pulse: "bg-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
  },
  amber: {
    dot: "bg-amber-500",
    pulse: "bg-amber-400",
    badge: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
  },
  orange: {
    dot: "bg-orange-500",
    pulse: "bg-orange-400",
    badge: "bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/20",
  },
  rose: {
    dot: "bg-rose-500",
    pulse: "bg-rose-400",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/10 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20",
  },
  violet: {
    dot: "bg-violet-500",
    pulse: "bg-violet-400",
    badge: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-700/10 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/20",
  },
  slate: {
    dot: "bg-slate-400",
    pulse: "bg-slate-300",
    badge: "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/10 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/20",
  },
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

function formatDisplayName(user: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email
}

const recordLinkClass =
  "inline-flex items-center font-medium text-blue-700 underline decoration-blue-300/70 decoration-1 underline-offset-[3px] transition-colors hover:text-blue-900 hover:decoration-blue-500 dark:text-blue-400 dark:decoration-blue-500/50 dark:hover:text-blue-300 dark:hover:decoration-blue-400"

export function BookingHeaderIndicator({
  label,
  value,
  tone = "slate",
  pulse = false,
  className,
}: {
  label: string
  value: string
  tone?: BookingHeaderIndicatorTone
  /** Kept for backwards compatibility — has no visual effect now. */
  variant?: "inline" | "status"
  /** Kept for backwards compatibility — icons are no longer rendered. */
  icon?: React.ComponentType<{ className?: string }>
  pulse?: boolean
  /** Kept for backwards compatibility — labels are not rendered inline. */
  showLabel?: boolean
  /** Kept for backwards compatibility — sizing is now uniform. */
  size?: "sm" | "md"
  className?: string
}) {
  const tones = TONE_STYLES[tone]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-medium transition-colors",
        tones.badge,
        className
      )}
      aria-label={`${label}: ${value}`}
    >
      <span className="relative flex h-1.5 w-1.5 items-center justify-center">
        {pulse ? (
          <span
            className={cn(
              "absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full opacity-70",
              tones.pulse
            )}
            aria-hidden
          />
        ) : null}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", tones.dot)} />
      </span>
      <span>{value}</span>
    </span>
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
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {children}
    </div>
  )
}

function MetadataItem({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 truncate text-sm font-semibold text-foreground">{children}</div>
    </div>
  )
}

function MetadataSeparator() {
  return (
    <span aria-hidden className="hidden h-3 w-px bg-slate-200 dark:bg-slate-800 sm:inline-block" />
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
  const instructionType =
    booking.booking_type === "flight" ? booking.flight_type?.instruction_type ?? null : null
  const instructionLabel = instructionType ? getInstructionTypeLabel(instructionType) : null

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
    <div
      className={cn(
        "relative border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
    >
      <div className="w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-6">
          <Link
            href={backHref}
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <IconArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            {backLabel}
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:gap-5">
          <div className="flex items-start justify-between gap-4 sm:gap-6">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
              <h1 className="min-w-0 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {title}
              </h1>
              <BookingHeaderIndicators className="gap-x-3">
                <BookingHeaderIndicator
                  label="Status"
                  value={badgeLabel}
                  tone={statusTone}
                  pulse={status === "flying"}
                />
                {extra}
              </BookingHeaderIndicators>
            </div>

            {actions ? (
              <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">{actions}</div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {studentName && booking.user_id ? (
              <>
                <MetadataItem label="Member">
                  {showRecordLinks ? (
                    <Link
                      href={`/members/${booking.user_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={recordLinkClass}
                    >
                      <span className="truncate">{studentName}</span>
                    </Link>
                  ) : (
                    <span className="truncate">{studentName}</span>
                  )}
                </MetadataItem>
                <MetadataSeparator />
              </>
            ) : null}

            {instructorName ? (
              <>
                <MetadataItem label="Instructor">
                  <span className="truncate">{instructorName}</span>
                </MetadataItem>
                <MetadataSeparator />
              </>
            ) : null}

            <MetadataItem label={isGroundwork ? "Session" : "Aircraft"}>
              {!isGroundwork && booking.aircraft_id && showRecordLinks ? (
                <Link
                  href={`/aircraft/${booking.aircraft_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={recordLinkClass}
                >
                  <span className="truncate">{assetLabel}</span>
                </Link>
              ) : (
                <span className="truncate">{assetLabel}</span>
              )}
            </MetadataItem>
            <MetadataSeparator />

            <MetadataItem label="Date">
              <span className="truncate">{dateLabel}</span>
            </MetadataItem>

            {instructionType && instructionLabel ? (
              <>
                <MetadataSeparator />
                <MetadataItem label="Type">
                  <span className="truncate">{instructionLabel}</span>
                </MetadataItem>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
