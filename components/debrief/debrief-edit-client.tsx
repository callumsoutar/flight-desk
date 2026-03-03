"use client"

import * as React from "react"

import { BookingHeader } from "@/components/bookings/booking-header"
import {
  BookingStatusTracker,
  deriveBookingTrackerState,
  getBookingTrackerStages,
} from "@/components/bookings/booking-status-tracker"
import { CheckinDebriefEditor } from "@/components/debrief/checkin-debrief-editor"
import { Badge } from "@/components/ui/badge"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type { LessonProgressWithInstructor } from "@/lib/types/debrief"
import type { LessonProgressRow } from "@/lib/types/tables"

function formatName(value: { first_name: string | null; last_name: string | null; email?: string | null } | null) {
  if (!value) return "—"
  return [value.first_name, value.last_name].filter(Boolean).join(" ") || value.email || "—"
}

function formatDateShort(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })
}

export function DebriefEditClient({
  bookingId,
  booking,
  lessonProgress,
}: {
  bookingId: string
  booking: BookingWithRelations
  lessonProgress: LessonProgressWithInstructor | null
}) {
  const [localLessonProgress, setLocalLessonProgress] = React.useState<LessonProgressRow | null>(
    lessonProgress ? (lessonProgress as LessonProgressRow) : null
  )

  const effectiveLessonProgress = localLessonProgress ?? (lessonProgress ? (lessonProgress as LessonProgressRow) : null)

  const instructionType = booking.flight_type?.instruction_type ?? null
  const studentName = formatName(booking.student)

  const effectiveInstructor =
    lessonProgress?.instructor ??
    booking.checked_out_instructor ??
    booking.instructor ??
    null

  const instructorName = effectiveInstructor
    ? formatName({
        first_name: effectiveInstructor.user?.first_name ?? effectiveInstructor.first_name,
        last_name: effectiveInstructor.user?.last_name ?? effectiveInstructor.last_name,
        email: effectiveInstructor.user?.email ?? null,
      })
    : "—"

  const aircraftReg = booking.checked_out_aircraft?.registration ?? booking.aircraft?.registration ?? "—"

  const bookingDate = formatDateShort(booking.start_time ?? null)
  const lessonName = booking.lesson?.name ?? "Training Flight"
  const invoiceId = booking.checkin_invoice_id ?? null
  const lessonProgressExists = Boolean(effectiveLessonProgress?.id)

  const trackerStages = React.useMemo(
    () => getBookingTrackerStages(Boolean(booking.briefing_completed)),
    [booking.briefing_completed]
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
        forceActiveStageId: "debrief",
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

  const headerActions = null

  return (
    <div className="min-h-screen bg-background pb-20">
      <BookingHeader
        booking={booking}
        title={`Write Debrief: ${lessonName}`}
        backHref={`/bookings/${bookingId}`}
        backLabel="Back to Booking"
        actions={headerActions}
        extra={
          effectiveLessonProgress?.status ? (
            <Badge
              variant={effectiveLessonProgress.status === "pass" ? "default" : "secondary"}
              className={
                effectiveLessonProgress.status === "pass"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
              }
            >
              {effectiveLessonProgress.status === "pass" ? "Pass" : "Not Yet Competent"}
            </Badge>
          ) : null
        }
      />

      <div className="mx-auto w-full max-w-7xl px-4 pt-6 pb-10 sm:px-6 lg:px-8">
        <BookingStatusTracker
          stages={trackerStages}
          activeStageId={trackerState.activeStageId}
          completedStageIds={trackerState.completedStageIds}
          className="mb-6"
        />
        <div className="space-y-6">
          <CheckinDebriefEditor
            bookingId={bookingId}
            instructionType={instructionType}
            initial={effectiveLessonProgress}
            meta={{
              memberName: studentName,
              instructorName,
              aircraftReg,
              bookingDate,
              lessonName,
              syllabusName: null,
            }}
            onSaved={(row) => setLocalLessonProgress(row)}
            continueHref={`/bookings/${bookingId}/debrief`}
            continueLabel="Save & View Debrief"
            viewHref={lessonProgressExists ? `/bookings/${bookingId}/debrief` : null}
            skipDebriefHref={invoiceId ? `/invoices/${invoiceId}` : null}
            collapsible={false}
            showMeta={false}
            defaultOpen
          />
        </div>
      </div>
    </div>
  )
}
