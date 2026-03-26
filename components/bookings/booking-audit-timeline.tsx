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
              colorClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            })
            break
          case "flying":
            changes.push({
              label: "Aircraft Checked Out",
              icon: <IconPlaneDeparture className="h-4 w-4" />,
              colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
            })
            break
          case "complete":
            changes.push({
              label: "Booking Completed",
              icon: <IconPlaneArrival className="h-4 w-4" />,
              colorClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            })
            break
          case "cancelled":
            changes.push({
              label: "Booking Cancelled",
              icon: <IconBan className="h-4 w-4" />,
              colorClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            })
            break
          default:
            changes.push({
              label: "Status",
              oldValue: BOOKING_STATUS_LABELS[oldStatus ?? ""] ?? (oldStatus ?? "—"),
              newValue: BOOKING_STATUS_LABELS[newStatus] ?? newStatus,
              icon: <IconTag className="h-4 w-4" />,
              colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
            })
        }
      }

      if (newData.start_time !== oldData.start_time) {
        changes.push({
          label: "Start Time",
          oldValue: formatAuditDateTime(str(oldData.start_time), timeZone),
          newValue: formatAuditDateTime(str(newData.start_time), timeZone),
          icon: <IconClock className="h-4 w-4" />,
          colorClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
        })
      }
      if (newData.end_time !== oldData.end_time) {
        changes.push({
          label: "End Time",
          oldValue: formatAuditDateTime(str(oldData.end_time), timeZone),
          newValue: formatAuditDateTime(str(newData.end_time), timeZone),
          icon: <IconClock className="h-4 w-4" />,
          colorClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
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
          colorClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
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
          colorClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
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
          colorClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
        })
      }

      if (newData.remarks !== oldData.remarks) {
        changes.push({
          label: "Remarks",
          oldValue: str(oldData.remarks) ?? "—",
          newValue: str(newData.remarks) ?? "—",
          icon: <IconPencil className="h-4 w-4" />,
          colorClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
        })
      }

      if (newData.purpose !== oldData.purpose) {
        changes.push({
          label: "Purpose",
          oldValue: str(oldData.purpose) ?? "—",
          newValue: str(newData.purpose) ?? "—",
          icon: <IconPencil className="h-4 w-4" />,
          colorClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
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
          colorClass: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
        })
      }

      if (newData.booking_type !== oldData.booking_type) {
        changes.push({
          label: "Booking Type",
          oldValue: BOOKING_TYPE_LABELS[str(oldData.booking_type) ?? ""] ?? str(oldData.booking_type) ?? "—",
          newValue: BOOKING_TYPE_LABELS[str(newData.booking_type) ?? ""] ?? str(newData.booking_type) ?? "—",
          icon: <IconTag className="h-4 w-4" />,
          colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
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
          colorClass: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
        })
      }

      if (newData.checked_out_at !== oldData.checked_out_at && newData.checked_out_at && !statusChanged) {
        changes.push({
          label: "Checked Out",
          newValue: formatAuditDateTime(str(newData.checked_out_at), timeZone),
          icon: <IconPlaneDeparture className="h-4 w-4" />,
          colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        })
      }

      if (newData.checked_in_at !== oldData.checked_in_at && newData.checked_in_at && !statusChanged) {
        changes.push({
          label: "Checked In",
          newValue: formatAuditDateTime(str(newData.checked_in_at), timeZone),
          icon: <IconPlaneArrival className="h-4 w-4" />,
          colorClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        })
      }

      if (newData.checkin_approved_at !== oldData.checkin_approved_at && newData.checkin_approved_at) {
        changes.push({
          label: "Check-In Approved",
          newValue: formatAuditDateTime(str(newData.checkin_approved_at), timeZone),
          icon: <IconCircleCheck className="h-4 w-4" />,
          colorClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        })
      }

      if (newData.invoice_id !== oldData.invoice_id && newData.invoice_id) {
        changes.push({
          label: "Invoice Linked",
          newValue: str(newData.invoice_id) ?? "—",
          icon: <IconFileDescription className="h-4 w-4" />,
          colorClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
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
          colorClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
        })
      }

      if (newData.contact_id !== oldData.contact_id) {
        changes.push({
          label: "Contact",
          oldValue: str(oldData.contact_id) ?? "—",
          newValue: str(newData.contact_id) ?? "—",
          icon: <IconAddressBook className="h-4 w-4" />,
          colorClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
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
    <div className="px-4 py-2 sm:px-6">
      {entries.map((entry, idx) => {
        const isLast = idx === entries.length - 1
        const firstChange = entry.isCreate ? null : entry.changes[0]
        const icon = entry.isCreate
          ? <IconCalendarPlus className="h-4 w-4" />
          : firstChange?.icon
        const colorClass = entry.isCreate
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : (firstChange?.colorClass ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400")

        return (
          <div key={entry.log.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", colorClass)}>
                {icon}
              </div>
              {!isLast && <div className="my-1 w-px flex-1 bg-border/40" />}
            </div>

            <div className={cn("min-w-0 flex-1", isLast ? "pb-2" : "pb-5")}>
              {entry.isCreate ? (
                <p className="text-sm font-semibold leading-8">Booking Created</p>
              ) : (
                <div className="space-y-1 pt-1.5">
                  {entry.changes.map((change, i) => (
                    <div key={i} className="flex flex-wrap items-baseline gap-1 text-sm">
                      <span className="font-medium">{change.label}</span>
                      {change.oldValue !== undefined && change.newValue !== undefined ? (
                        <>
                          <span className="text-muted-foreground line-through">{change.oldValue}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{change.newValue}</span>
                        </>
                      ) : change.newValue !== undefined ? (
                        <span className="text-muted-foreground">{change.newValue}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(entry.log.created_at, timeZone)}
                {" · "}
                {entry.log.user ? formatUser(entry.log.user) : "System"}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
