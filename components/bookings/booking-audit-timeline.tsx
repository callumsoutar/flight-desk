"use client"

import * as React from "react"
import {
  IconAddressBook,
  IconBan,
  IconBook,
  IconCalendarPlus,
  IconCircleCheck,
  IconClock,
  IconFileDescription,
  IconPencil,
  IconPlane,
  IconPlaneArrival,
  IconPlaneDeparture,
  IconTag,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"

import { useTimezone } from "@/contexts/timezone-context"
import type { AuditLog, AuditLookupMaps } from "@/lib/types/bookings"
import { formatDateTime } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"

function formatUser(user: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Unknown"
}

const COLORS = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  green: "text-green-600 dark:text-green-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
  blue: "text-blue-600 dark:text-blue-400",
  slate: "text-slate-500 dark:text-slate-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  purple: "text-purple-600 dark:text-purple-400",
  sky: "text-sky-600 dark:text-sky-400",
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  unconfirmed: "Unconfirmed",
  confirmed: "Confirmed",
  flying: "Flying",
  complete: "Complete",
  cancelled: "Cancelled",
}

const BOOKING_TYPE_LABELS: Record<string, string> = {
  flight: "Flight",
  ground: "Ground",
  simulator: "Simulator",
  maintenance: "Maintenance",
  unavailable: "Unavailable",
}

function formatAuditDateTime(value: string | null | undefined, timeZone: string): string {
  if (!value) return "—"
  return formatDateTime(value, timeZone) || "—"
}

type AuditChangeEntry = {
  label: string
  oldValue?: string
  newValue?: string
  icon: React.ReactNode
  colorClass: string
}

type AuditEntryData = {
  log: AuditLog
  isCreate: boolean
  changes: AuditChangeEntry[]
}

function computeAuditEntries(
  logs: AuditLog[],
  maps: AuditLookupMaps,
  timeZone: string
): AuditEntryData[] {
  return logs
    .map((log): AuditEntryData | null => {
      if (log.action === "INSERT") {
        return { log, isCreate: true, changes: [] }
      }

      const newData = log.new_data as Record<string, unknown> | null
      const oldData = log.old_data as Record<string, unknown> | null
      if (!newData || !oldData) return null

      const str = (v: unknown): string | null =>
        v === null || v === undefined ? null : String(v)

      const changes: AuditChangeEntry[] = []
      const newStatus = str(newData.status)
      const oldStatus = str(oldData.status)
      const statusChanged = newStatus !== oldStatus

      if (statusChanged && newStatus) {
        switch (newStatus) {
          case "confirmed":
            changes.push({
              label: "Booking Confirmed",
              icon: <IconCircleCheck className="h-4 w-4" />,
              colorClass: COLORS.green,
            })
            break
          case "flying":
            changes.push({
              label: "Aircraft Checked Out",
              icon: <IconPlaneDeparture className="h-4 w-4" />,
              colorClass: COLORS.blue,
            })
            break
          case "complete":
            changes.push({
              label: "Booking Completed",
              icon: <IconPlaneArrival className="h-4 w-4" />,
              colorClass: COLORS.green,
            })
            break
          case "cancelled":
            changes.push({
              label: "Booking Cancelled",
              icon: <IconBan className="h-4 w-4" />,
              colorClass: COLORS.red,
            })
            break
          default:
            changes.push({
              label: "Status",
              oldValue: BOOKING_STATUS_LABELS[oldStatus ?? ""] ?? (oldStatus ?? "—"),
              newValue: BOOKING_STATUS_LABELS[newStatus] ?? newStatus,
              icon: <IconTag className="h-4 w-4" />,
              colorClass: COLORS.amber,
            })
        }
      }

      if (newData.start_time !== oldData.start_time) {
        changes.push({
          label: "Start Time",
          oldValue: formatAuditDateTime(str(oldData.start_time), timeZone),
          newValue: formatAuditDateTime(str(newData.start_time), timeZone),
          icon: <IconClock className="h-4 w-4" />,
          colorClass: COLORS.slate,
        })
      }
      if (newData.end_time !== oldData.end_time) {
        changes.push({
          label: "End Time",
          oldValue: formatAuditDateTime(str(oldData.end_time), timeZone),
          newValue: formatAuditDateTime(str(newData.end_time), timeZone),
          icon: <IconClock className="h-4 w-4" />,
          colorClass: COLORS.slate,
        })
      }

      if (newData.instructor_id !== oldData.instructor_id) {
        const oldId = str(oldData.instructor_id)
        const newId = str(newData.instructor_id)
        changes.push({
          label: "Instructor",
          oldValue: oldId ? (maps.instructors[oldId] ?? "Unknown") : "—",
          newValue: newId ? (maps.instructors[newId] ?? "Unknown") : "—",
          icon: <IconUser className="h-4 w-4" />,
          colorClass: COLORS.purple,
        })
      }

      if (newData.user_id !== oldData.user_id) {
        const oldId = str(oldData.user_id)
        const newId = str(newData.user_id)
        changes.push({
          label: "Member",
          oldValue: oldId ? (maps.users[oldId] ?? "Unknown") : "—",
          newValue: newId ? (maps.users[newId] ?? "Unknown") : "—",
          icon: <IconUser className="h-4 w-4" />,
          colorClass: COLORS.purple,
        })
      }

      if (newData.lesson_id !== oldData.lesson_id) {
        const oldId = str(oldData.lesson_id)
        const newId = str(newData.lesson_id)
        changes.push({
          label: "Lesson",
          oldValue: oldId ? (maps.lessons[oldId] ?? "Unknown") : "—",
          newValue: newId ? (maps.lessons[newId] ?? "Unknown") : "—",
          icon: <IconBook className="h-4 w-4" />,
          colorClass: COLORS.indigo,
        })
      }

      if (newData.remarks !== oldData.remarks) {
        changes.push({
          label: "Remarks",
          oldValue: str(oldData.remarks) ?? "—",
          newValue: str(newData.remarks) ?? "—",
          icon: <IconPencil className="h-4 w-4" />,
          colorClass: COLORS.slate,
        })
      }

      if (newData.purpose !== oldData.purpose) {
        changes.push({
          label: "Purpose",
          oldValue: str(oldData.purpose) ?? "—",
          newValue: str(newData.purpose) ?? "—",
          icon: <IconPencil className="h-4 w-4" />,
          colorClass: COLORS.slate,
        })
      }

      if (newData.flight_type_id !== oldData.flight_type_id) {
        const oldId = str(oldData.flight_type_id)
        const newId = str(newData.flight_type_id)
        changes.push({
          label: "Flight Type",
          oldValue: oldId ? (maps.flightTypes[oldId] ?? "Unknown") : "—",
          newValue: newId ? (maps.flightTypes[newId] ?? "Unknown") : "—",
          icon: <IconPlane className="h-4 w-4" />,
          colorClass: COLORS.sky,
        })
      }

      if (newData.booking_type !== oldData.booking_type) {
        changes.push({
          label: "Booking Type",
          oldValue: BOOKING_TYPE_LABELS[str(oldData.booking_type) ?? ""] ?? str(oldData.booking_type) ?? "—",
          newValue: BOOKING_TYPE_LABELS[str(newData.booking_type) ?? ""] ?? str(newData.booking_type) ?? "—",
          icon: <IconTag className="h-4 w-4" />,
          colorClass: COLORS.amber,
        })
      }

      if (newData.aircraft_id !== oldData.aircraft_id) {
        const oldId = str(oldData.aircraft_id)
        const newId = str(newData.aircraft_id)
        changes.push({
          label: "Aircraft",
          oldValue: oldId ? (maps.aircraft[oldId] ?? "Unknown") : "—",
          newValue: newId ? (maps.aircraft[newId] ?? "Unknown") : "—",
          icon: <IconPlane className="h-4 w-4" />,
          colorClass: COLORS.sky,
        })
      }

      if (newData.checked_out_at !== oldData.checked_out_at && newData.checked_out_at && !statusChanged) {
        changes.push({
          label: "Checked Out",
          newValue: formatAuditDateTime(str(newData.checked_out_at), timeZone),
          icon: <IconPlaneDeparture className="h-4 w-4" />,
          colorClass: COLORS.blue,
        })
      }

      if (newData.checked_in_at !== oldData.checked_in_at && newData.checked_in_at && !statusChanged) {
        changes.push({
          label: "Checked In",
          newValue: formatAuditDateTime(str(newData.checked_in_at), timeZone),
          icon: <IconPlaneArrival className="h-4 w-4" />,
          colorClass: COLORS.green,
        })
      }

      if (newData.checkin_approved_at !== oldData.checkin_approved_at && newData.checkin_approved_at) {
        changes.push({
          label: "Check-In Approved",
          newValue: formatAuditDateTime(str(newData.checkin_approved_at), timeZone),
          icon: <IconCircleCheck className="h-4 w-4" />,
          colorClass: COLORS.green,
        })
      }

      if (newData.invoice_id !== oldData.invoice_id && newData.invoice_id) {
        changes.push({
          label: "Invoice Linked",
          newValue: str(newData.invoice_id) ?? "—",
          icon: <IconFileDescription className="h-4 w-4" />,
          colorClass: COLORS.slate,
        })
      }

      if (newData.attendees !== oldData.attendees) {
        const oldAttendees = Array.isArray(oldData.attendees) ? oldData.attendees.length : 0
        const newAttendees = Array.isArray(newData.attendees) ? newData.attendees.length : 0
        changes.push({
          label: "Attendees",
          oldValue: String(oldAttendees),
          newValue: String(newAttendees),
          icon: <IconUsers className="h-4 w-4" />,
          colorClass: COLORS.slate,
        })
      }

      if (newData.contact_id !== oldData.contact_id) {
        changes.push({
          label: "Contact",
          oldValue: str(oldData.contact_id) ?? "—",
          newValue: str(newData.contact_id) ?? "—",
          icon: <IconAddressBook className="h-4 w-4" />,
          colorClass: COLORS.slate,
        })
      }

      if (changes.length === 0) return null
      return { log, isCreate: false, changes }
    })
    .filter((entry): entry is AuditEntryData => entry !== null)
}

export function BookingAuditTimeline({
  logs,
  maps,
}: {
  logs: AuditLog[]
  maps: AuditLookupMaps
}) {
  const { timeZone } = useTimezone()
  const entries = computeAuditEntries(logs, maps, timeZone)

  if (entries.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        No history available
      </div>
    )
  }

  return (
    <div className="px-4 py-3 sm:px-6">
      <div className="space-y-4">
        {entries.map((entry) => {
          const firstChange = entry.isCreate ? null : entry.changes[0]
          const icon = entry.isCreate ? (
            <IconCalendarPlus className="h-4 w-4" />
          ) : (
            firstChange?.icon
          )
          const colorClass = entry.isCreate
            ? COLORS.emerald
            : (firstChange?.colorClass ?? COLORS.slate)

          return (
            <div key={entry.log.id} className="flex gap-3 text-sm">
              <div
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center",
                  colorClass
                )}
              >
                {icon}
              </div>
              <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  {entry.isCreate ? (
                    <div className="font-medium text-foreground">Booking Created</div>
                  ) : (
                    entry.changes.map((change, i) => (
                      <div key={i} className="flex flex-wrap items-baseline gap-1.5">
                        <span className="font-medium text-foreground">{change.label}</span>
                        {change.oldValue !== undefined && change.newValue !== undefined ? (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="line-through">{change.oldValue}</span>
                            <span>→</span>
                            <span className="text-foreground">{change.newValue}</span>
                          </div>
                        ) : change.newValue !== undefined ? (
                          <span className="text-muted-foreground">{change.newValue}</span>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:pt-0.5">
                  <time dateTime={entry.log.created_at ?? undefined}>
                    {formatDateTime(entry.log.created_at ?? "", timeZone) || "—"}
                  </time>
                  <span className="text-border">•</span>
                  <span>{entry.log.user ? formatUser(entry.log.user) : "System"}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
