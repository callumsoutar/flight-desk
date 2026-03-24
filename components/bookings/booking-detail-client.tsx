"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconAddressBook,
  IconBan,
  IconBook,
  IconCalendarPlus,
  IconCheck,
  IconChevronDown,
  IconCircleCheck,
  IconClock,
  IconDotsVertical,
  IconFileDescription,
  IconMail,
  IconPencil,
  IconPlane,
  IconPlaneDeparture,
  IconPlaneArrival,
  IconTag,
  IconTrash,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { updateBookingAction, updateBookingStatusAction } from "@/app/bookings/actions"
import {
  BookingEditDetailsCard,
  createBookingEditInitialState,
  normalizeBookingEditFormState,
  type BookingEditFormState,
} from "@/components/bookings/booking-edit-details-card"
import { BookingHeader } from "@/components/bookings/booking-header"
import { BookingPageContent } from "@/components/bookings/booking-page-content"
import {
  BookingStatusTracker,
  deriveBookingTrackerState,
  getBookingTrackerStages,
} from "@/components/bookings/booking-status-tracker"
import { CancelBookingModal, type CancelBookingPayload } from "@/components/bookings/cancel-booking-modal"
import { ContactDetailsModal } from "@/components/members/contact-details-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import { useAuth } from "@/contexts/auth-context"
import { useTimezone } from "@/contexts/timezone-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/utils/date-format"
import type { AuditLog, AuditLookupMaps, BookingOptions, BookingStatus, BookingWithRelations } from "@/lib/types/bookings"
import type { UserRole } from "@/lib/types/roles"

function toIso(value: string) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

function formatUser(user: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Unknown"
}

// ─── Audit log helpers ───────────────────────────────────────────────────────

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

      // Status transitions (mapped to meaningful events)
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

      // Time changes
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

      // Instructor change
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

      // Member change
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

      // Lesson change
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

      // Remarks change
      if (newData.remarks !== oldData.remarks) {
        changes.push({
          label: "Remarks",
          oldValue: str(oldData.remarks) ?? "—",
          newValue: str(newData.remarks) ?? "—",
          icon: <IconPencil className="h-4 w-4" />,
          colorClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
        })
      }

      // Purpose / description change
      if (newData.purpose !== oldData.purpose) {
        changes.push({
          label: "Purpose",
          oldValue: str(oldData.purpose) ?? "—",
          newValue: str(newData.purpose) ?? "—",
          icon: <IconPencil className="h-4 w-4" />,
          colorClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
        })
      }

      // Flight type change
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

      // Booking type change
      if (newData.booking_type !== oldData.booking_type) {
        changes.push({
          label: "Booking Type",
          oldValue: BOOKING_TYPE_LABELS[str(oldData.booking_type) ?? ""] ?? str(oldData.booking_type) ?? "—",
          newValue: BOOKING_TYPE_LABELS[str(newData.booking_type) ?? ""] ?? str(newData.booking_type) ?? "—",
          icon: <IconTag className="h-4 w-4" />,
          colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        })
      }

      // Aircraft change
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

      // Checked out (when set for the first time without a status change to "flying")
      if (newData.checked_out_at !== oldData.checked_out_at && newData.checked_out_at && !statusChanged) {
        changes.push({
          label: "Checked Out",
          newValue: formatAuditDateTime(str(newData.checked_out_at), timeZone),
          icon: <IconPlaneDeparture className="h-4 w-4" />,
          colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        })
      }

      // Checked in (when set for the first time without a status change to "complete")
      if (newData.checked_in_at !== oldData.checked_in_at && newData.checked_in_at && !statusChanged) {
        changes.push({
          label: "Checked In",
          newValue: formatAuditDateTime(str(newData.checked_in_at), timeZone),
          icon: <IconPlaneArrival className="h-4 w-4" />,
          colorClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        })
      }

      // Checkin approved
      if (newData.checkin_approved_at !== oldData.checkin_approved_at && newData.checkin_approved_at) {
        changes.push({
          label: "Check-In Approved",
          newValue: formatAuditDateTime(str(newData.checkin_approved_at), timeZone),
          icon: <IconCircleCheck className="h-4 w-4" />,
          colorClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        })
      }

      if (changes.length === 0) return null
      return { log, isCreate: false, changes }
    })
    .filter((entry): entry is AuditEntryData => entry !== null)
}

function AuditTimeline({ logs, maps }: { logs: AuditLog[]; maps: AuditLookupMaps }) {
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
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", colorClass)}>
                {icon}
              </div>
              {!isLast && <div className="w-px flex-1 bg-border/40 my-1" />}
            </div>

            {/* Content */}
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

export function BookingDetailClient({
  bookingId,
  booking,
  options,
  auditLogs,
  auditLookupMaps,
  role,
}: {
  bookingId: string
  booking: BookingWithRelations
  options: BookingOptions
  auditLogs: AuditLog[]
  auditLookupMaps: AuditLookupMaps
  role: UserRole | null
}) {
  const router = useRouter()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const serverInitialForm = React.useMemo(() => createBookingEditInitialState(booking), [booking])
  const [form, setForm] = React.useState<BookingEditFormState>(() => serverInitialForm)
  const [savedForm, setSavedForm] = React.useState<BookingEditFormState>(() => serverInitialForm)
  const savedFormRef = React.useRef(savedForm)
  const [isPending, startTransition] = React.useTransition()
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [sendingConfirmation, setSendingConfirmation] = React.useState(false)
  const [contactOpen, setContactOpen] = React.useState(false)
  const [contactMemberId, setContactMemberId] = React.useState<string | null>(null)
  const [auditOpen, setAuditOpen] = React.useState(true)

  React.useEffect(() => {
    savedFormRef.current = savedForm
  }, [savedForm])

  React.useEffect(() => {
    const prevSaved = savedFormRef.current
    setSavedForm(serverInitialForm)
    savedFormRef.current = serverInitialForm

    setForm((current) =>
      JSON.stringify(current) === JSON.stringify(prevSaved) ? serverInitialForm : current
    )
  }, [serverInitialForm])

  const isDirty = React.useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(savedForm)
  }, [form, savedForm])

  const isAdminOrInstructor = role === "owner" || role === "admin" || role === "instructor"
  const isMemberOrStudent = role === "member" || role === "student"
  const isReadOnly = booking.status === "complete" || booking.status === "cancelled"
  const canViewContact = isAdminOrInstructor || (Boolean(user?.id) && booking.user_id === user?.id)

  const openContactDetails = React.useCallback(
    (memberId: string) => {
      setContactMemberId(memberId)
      setContactOpen(true)
    },
    []
  )

  const updateField = <K extends keyof BookingEditFormState>(key: K, value: BookingEditFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = () => {
    if (isReadOnly || !isDirty) return
    startTransition(async () => {
      const nextSaved = normalizeBookingEditFormState({
        ...form,
        start_time: toIso(form.start_time),
        end_time: toIso(form.end_time),
      })

      const result = await updateBookingAction(bookingId, {
        ...nextSaved,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Booking updated")
      setForm(nextSaved)
      setSavedForm(nextSaved)
      savedFormRef.current = nextSaved
      router.refresh()
    })
  }

  const handleStatusChange = (status: BookingStatus) => {
    startTransition(async () => {
      const result = await updateBookingStatusAction(bookingId, status)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Booking updated")
      router.refresh()
    })
  }

  const handleSendConfirmationEmail = React.useCallback(async () => {
    setSendingConfirmation(true)
    try {
      const response = await fetch(`/api/bookings/${bookingId}/send-confirmation-email`, {
        method: "POST",
      })
      const json = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        toast.error(json.error || "Failed to send confirmation email")
        return
      }
      toast.success("Confirmation email sent")
    } finally {
      setSendingConfirmation(false)
    }
  }, [bookingId])

  const handleCancel = (payload: CancelBookingPayload) => {
    startTransition(async () => {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          cancellation_category_id: payload.cancellationCategoryId,
          cancellation_reason: payload.cancellationReason,
          cancelled_notes: payload.cancelledNotes,
        }),
      })

      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string }
        toast.error(json.error || "Failed to cancel booking")
        return
      }

      toast.success("Booking cancelled")
      setCancelOpen(false)
      router.refresh()
    })
  }

  const canSendConfirmationEmail =
    Boolean(booking.student?.email?.trim()) && booking.status !== "cancelled"

  const studentName = booking.student ? formatUser(booking.student) : "—"
  const studentMemberId = booking.user_id
  const instructorName = booking.instructor
    ? formatUser({
        first_name: booking.instructor.user?.first_name ?? booking.instructor.first_name,
        last_name: booking.instructor.user?.last_name ?? booking.instructor.last_name,
        email: booking.instructor.user?.email ?? null,
      })
    : "—"
  const lessonProgressExists = React.useMemo(() => {
    if (!booking.lesson_progress) return false
    return Array.isArray(booking.lesson_progress) ? booking.lesson_progress.length > 0 : true
  }, [booking.lesson_progress])
  const includeDebriefStage = booking.flight_type?.instruction_type !== "solo"
  const trackerStages = React.useMemo(
    () => getBookingTrackerStages(Boolean(booking.briefing_completed), includeDebriefStage),
    [booking.briefing_completed, includeDebriefStage]
  )
  const trackerState = React.useMemo(
    () =>
      deriveBookingTrackerState({
        stages: trackerStages,
        status: booking.status,
        briefingCompleted: booking.briefing_completed,
        authorizationCompleted: booking.authorization_completed,
        checkedOutAt: booking.checked_out_at,
        checkedInAt: booking.checked_in_at,
        checkinApprovedAt: booking.checkin_approved_at,
        hasDebrief: lessonProgressExists,
      }),
    [
      booking.authorization_completed,
      booking.briefing_completed,
      booking.checkin_approved_at,
      booking.checked_in_at,
      booking.checked_out_at,
      booking.status,
      lessonProgressExists,
      trackerStages,
    ]
  )

  const headerActions =
    lessonProgressExists || isAdminOrInstructor ? (
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
        {lessonProgressExists ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            asChild
          >
            <Link href={`/bookings/${bookingId}/debrief`}>
              <IconFileDescription className="mr-2 h-4 w-4" />
              View Debrief
            </Link>
          </Button>
        ) : null}
        {isAdminOrInstructor && (
          <>
            {booking.status === "unconfirmed" ? (
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => handleStatusChange("confirmed")}
                disabled={isPending}
              >
                <IconCheck className="mr-2 h-4 w-4" />
                Confirm
              </Button>
            ) : null}
            {booking.status === "confirmed" ? (
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => router.push(`/bookings/checkout/${bookingId}`)}
                disabled={isPending}
              >
                <IconPlane className="mr-2 h-4 w-4" />
                Check Out
              </Button>
            ) : null}
            {booking.status === "flying" ? (
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => router.push(`/bookings/checkin/${bookingId}`)}
                disabled={isPending}
              >
                <IconCheck className="mr-2 h-4 w-4" />
                Check In
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden w-full sm:inline-flex sm:w-auto">
                  More
                  <IconChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!canSendConfirmationEmail || sendingConfirmation}
                  onClick={() => void handleSendConfirmationEmail()}
                >
                  <IconMail className="mr-2 h-4 w-4" />
                  Send confirmation email
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  disabled={isReadOnly || !!booking.cancelled_at}
                  onClick={() => setCancelOpen(true)}
                >
                  <IconTrash className="mr-2 h-4 w-4" />
                  Cancel Booking
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    ) : null

  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      <BookingHeader
        booking={booking}
        title={studentName}
        backHref="/bookings"
        actions={headerActions}
      />

      <div className="w-full max-w-none flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8">
        <BookingStatusTracker
          stages={trackerStages}
          activeStageId={trackerState.activeStageId}
          completedStageIds={trackerState.completedStageIds}
          className="mb-6"
        />

        <BookingPageContent className="space-y-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            <div className="space-y-6 lg:col-span-2">
              <BookingEditDetailsCard
                form={form}
                options={options}
                isReadOnly={isReadOnly}
                isAdminOrInstructor={isAdminOrInstructor}
                isMemberOrStudent={isMemberOrStudent}
                onFieldChange={updateField}
              />
            </div>

            <div className="space-y-6">
              <Card className="rounded-xl border border-border/50 shadow-md">
                <CardHeader className="border-b border-border/20 pb-5">
                  <CardTitle className="text-xl font-bold">Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <IconUsers className="h-4 w-4" />
                      <h3 className="text-sm font-bold uppercase tracking-wider">People</h3>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Member</span>
                        <div className="flex items-center gap-1.5">
                          {canViewContact && studentMemberId ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openContactDetails(studentMemberId)}
                              aria-label="View contact details"
                            >
                              <IconAddressBook className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Badge variant="outline" className="text-xs">Student</Badge>
                        </div>
                      </div>
                      <div className="font-bold">{studentName}</div>
                      {booking.student?.email ? <div className="text-sm text-muted-foreground">{booking.student.email}</div> : null}
                    </div>
                    {booking.instructor ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">Instructor</span>
                          <Badge variant="outline" className="text-xs">Staff</Badge>
                        </div>
                        <div className="font-bold">{instructorName}</div>
                        {booking.instructor.user?.email ? (
                          <div className="text-sm text-muted-foreground">{booking.instructor.user.email}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <IconPlane className="h-4 w-4" />
                      <h3 className="text-sm font-bold uppercase tracking-wider">Aircraft</h3>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                      {booking.aircraft ? (
                        <>
                          <div className="font-bold">{booking.aircraft.registration} ({booking.aircraft.type})</div>
                          <div className="text-sm text-muted-foreground">
                            {booking.aircraft.manufacturer}{booking.aircraft.model ? `, ${booking.aircraft.model}` : ""}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">No aircraft assigned</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="rounded-xl border border-border/50 shadow-md">
            <CardHeader className="border-b border-border/20 p-0">
              <Button
                variant="ghost"
                className="h-auto w-full justify-start gap-2 rounded-none px-6 py-4 text-left"
                onClick={() => setAuditOpen((prev) => !prev)}
              >
                <IconChevronDown className={cn("h-4 w-4 transition-transform", !auditOpen && "-rotate-90")} />
                <CardTitle className="text-base sm:text-lg">Booking History</CardTitle>
              </Button>
            </CardHeader>
            {auditOpen ? (
              <CardContent className="px-0 pt-4 pb-2">
                <AuditTimeline logs={auditLogs} maps={auditLookupMaps} />
              </CardContent>
            ) : null}
          </Card>
        </BookingPageContent>
      </div>

      {!isReadOnly ? (
        <StickyFormActions
          isDirty={isDirty}
          isSaving={isPending}
          onUndo={() => setForm(savedFormRef.current)}
          onSave={handleSave}
          message="You have unsaved booking details."
          undoLabel="Undo Changes"
          saveLabel="Save Changes"
        />
      ) : null}

      {isMobile && isAdminOrInstructor && !isReadOnly ? (
        <div className="fixed bottom-0 right-0 z-40 p-4">
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className="h-12 w-12 rounded-full shadow-xl ring-1 ring-border/40"
                aria-label="Open booking actions"
              >
                <IconDotsVertical className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Booking actions</DrawerTitle>
                <DrawerDescription>Manage this booking.</DrawerDescription>
              </DrawerHeader>
              <div className="space-y-2 px-4 pb-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!canSendConfirmationEmail || sendingConfirmation}
                  onClick={() => void handleSendConfirmationEmail()}
                >
                  <IconMail className="mr-2 h-4 w-4" />
                  Send confirmation email
                </Button>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  disabled={isReadOnly || !!booking.cancelled_at}
                  onClick={() => setCancelOpen(true)}
                >
                  <IconTrash className="mr-2 h-4 w-4" />
                  Cancel Booking
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full">Close</Button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      ) : null}

      <ContactDetailsModal
        open={contactOpen}
        onOpenChange={(open) => {
          setContactOpen(open)
          if (!open) setContactMemberId(null)
        }}
        memberId={contactMemberId}
      />

      <CancelBookingModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        booking={booking}
        onConfirm={handleCancel}
        pending={isPending}
      />
    </div>
  )
}
