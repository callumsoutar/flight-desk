import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { fetchUnavailableResourceIds } from "@/lib/bookings/resource-availability"
import {
  buildBookingUpdatedChanges,
  type BookingUpdatedComparable,
} from "@/lib/email/build-booking-updated-changes"
import { sendBookingCancelledEmailForBooking } from "@/lib/email/send-booking-cancelled-for-booking"
import { sendBookingConfirmedEmailForBooking } from "@/lib/email/send-booking-confirmed-for-booking"
import { sendBookingUpdatedEmailForBooking } from "@/lib/email/send-booking-updated-for-booking"
import { logError } from "@/lib/security/logger"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { BookingStatus } from "@/lib/types/bookings"

const BOOKING_SELECT =
  "*, student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), checked_out_instructor:instructors!bookings_checked_out_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(id, registration, type, model, manufacturer, current_hobbs, current_tach), checked_out_aircraft:aircraft!bookings_checked_out_aircraft_id_fkey(id, registration, type, model, manufacturer, current_hobbs, current_tach), flight_type:flight_types!bookings_flight_type_id_fkey(id, name, instruction_type), lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id), lesson_progress(*)"

const patchSchema = z.strictObject({
  status: z
    .enum(["unconfirmed", "confirmed", "briefing", "flying", "complete", "cancelled"])
    .optional(),
  cancellation_category_id: z.string().uuid().nullable().optional(),
  cancellation_reason: z.string().max(500).nullable().optional(),
  cancelled_notes: z.string().max(2000).nullable().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  aircraft_id: z.string().uuid().nullable().optional(),
  instructor_id: z.string().uuid().nullable().optional(),
})

export const dynamic = "force-dynamic"

function formatInstructorName(instructor: {
  first_name?: string | null
  last_name?: string | null
  user?: { first_name?: string | null; last_name?: string | null } | null
} | null): string | null {
  if (!instructor) return null
  const fromUser = [instructor.user?.first_name, instructor.user?.last_name].filter(Boolean).join(" ").trim()
  if (fromUser) return fromUser
  const direct = [instructor.first_name, instructor.last_name].filter(Boolean).join(" ").trim()
  return direct || null
}

function toComparableBooking(input: {
  aircraft?: { registration?: string | null } | null
  instructor?: {
    first_name?: string | null
    last_name?: string | null
    user?: { first_name?: string | null; last_name?: string | null } | null
  } | null
  purpose?: string | null
  remarks?: string | null
  lesson?: { name?: string | null } | null
}): BookingUpdatedComparable {
  return {
    aircraftRegistration: input.aircraft?.registration ?? null,
    instructorName: formatInstructorName(input.instructor ?? null),
    purpose: input.purpose ?? null,
    description: input.remarks ?? null,
    lessonName: input.lesson?.name ?? null,
  }
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, { includeRole: true, includeTenant: true })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Account not configured" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { id } = await context.params

  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: "Failed to load booking" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
  if (!data) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  if (!isStaffRole(role) && data.user_id !== user.id) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { booking: data },
    { headers: { "cache-control": "no-store" } }
  )
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Account not configured" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { id } = await context.params
  const payload = patchSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: existing, error: existingError } = await supabase
    .from("bookings")
    .select(
      "id, user_id, status, start_time, end_time, aircraft_id, instructor_id, purpose, remarks, lesson_id, aircraft:aircraft!bookings_aircraft_id_fkey(id, registration), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user:user_directory!instructors_user_id_fkey(first_name, last_name, email)), lesson:lessons!bookings_lesson_id_fkey(id, name)"
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json(
      { error: "Failed to load booking" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
  if (!existing) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  const staff = isStaffRole(role)
  const isOwn = existing.user_id === user.id

  const nextStatus = payload.data.status
  if (nextStatus === "confirmed" && !staff) {
    return NextResponse.json(
      { error: "Only staff can confirm bookings" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }
  if (nextStatus === "cancelled" && !staff && !isOwn) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }
  if (!nextStatus && !staff && !isOwn) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const hasTimeChange = "start_time" in payload.data || "end_time" in payload.data
  const hasScheduleChange =
    hasTimeChange ||
    "aircraft_id" in payload.data ||
    "instructor_id" in payload.data
  const hasCancellationChange =
    "cancellation_category_id" in payload.data ||
    "cancellation_reason" in payload.data ||
    "cancelled_notes" in payload.data

  if (hasScheduleChange && !staff) {
    return NextResponse.json(
      { error: "Only staff can reschedule bookings" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  if (hasScheduleChange && (existing.status === "cancelled" || existing.status === "complete")) {
    return NextResponse.json(
      { error: "This booking can no longer be rescheduled" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }
  if (hasCancellationChange && nextStatus !== "cancelled") {
    return NextResponse.json(
      { error: "Cancellation details can only be set when cancelling a booking" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const updatePayload: {
    status?: BookingStatus
    cancellation_category_id?: string | null
    cancellation_reason?: string | null
    cancelled_notes?: string | null
    cancelled_at?: string | null
    cancelled_by?: string | null
    start_time?: string
    end_time?: string
    aircraft_id?: string | null
    instructor_id?: string | null
  } = {}

  if (nextStatus) {
    updatePayload.status = nextStatus
  }

  if (nextStatus === "cancelled") {
    const cancellationCategoryId = payload.data.cancellation_category_id ?? null
    const cancellationReason = (payload.data.cancellation_reason ?? "").trim()
    const cancelledNotes = payload.data.cancelled_notes?.trim() ?? null

    if (!cancellationCategoryId) {
      return NextResponse.json(
        { error: "Cancellation category is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }
    if (!cancellationReason) {
      return NextResponse.json(
        { error: "Cancellation reason is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    const { data: cancellationCategory, error: cancellationCategoryError } = await supabase
      .from("cancellation_categories")
      .select("id")
      .eq("id", cancellationCategoryId)
      .eq("tenant_id", tenantId)
      .is("voided_at", null)
      .maybeSingle()

    if (cancellationCategoryError || !cancellationCategory) {
      return NextResponse.json(
        { error: "Selected cancellation category was not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }

    updatePayload.cancelled_at = new Date().toISOString()
    updatePayload.cancelled_by = user.id
    updatePayload.cancellation_category_id = cancellationCategoryId
    updatePayload.cancellation_reason = cancellationReason
    updatePayload.cancelled_notes = cancelledNotes || null
  }

  if (hasScheduleChange) {
    const nextStartRaw = payload.data.start_time ?? existing.start_time
    const nextEndRaw = payload.data.end_time ?? existing.end_time
    const nextStartDate = new Date(nextStartRaw)
    const nextEndDate = new Date(nextEndRaw)

    if (
      Number.isNaN(nextStartDate.getTime()) ||
      Number.isNaN(nextEndDate.getTime()) ||
      nextStartDate >= nextEndDate
    ) {
      return NextResponse.json(
        { error: "Invalid booking time range" },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    const nextAircraftId =
      "aircraft_id" in payload.data ? payload.data.aircraft_id : existing.aircraft_id
    const nextInstructorId =
      "instructor_id" in payload.data ? payload.data.instructor_id : existing.instructor_id

    const [aircraftCheck, instructorCheck, availabilityResult] = await Promise.all([
      nextAircraftId
        ? supabase
            .from("aircraft")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("id", nextAircraftId)
            .eq("on_line", true)
            .maybeSingle()
        : Promise.resolve({ data: true, error: null }),
      nextInstructorId
        ? supabase
            .from("instructors")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("id", nextInstructorId)
            .eq("is_actively_instructing", true)
            .maybeSingle()
        : Promise.resolve({ data: true, error: null }),
      fetchUnavailableResourceIds({
        supabase,
        tenantId,
        startTimeIso: nextStartDate.toISOString(),
        endTimeIso: nextEndDate.toISOString(),
        excludeBookingId: id,
      }),
    ])

    if (aircraftCheck.error || !aircraftCheck.data) {
      return NextResponse.json(
        { error: "Selected aircraft was not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }

    if (instructorCheck.error || !instructorCheck.data) {
      return NextResponse.json(
        { error: "Selected instructor was not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }

    const { unavailableAircraftIds, unavailableInstructorIds } = availabilityResult

    if (nextAircraftId && unavailableAircraftIds.includes(nextAircraftId)) {
      return NextResponse.json(
        { error: "Selected aircraft is no longer available for this time range." },
        { status: 409, headers: { "cache-control": "no-store" } }
      )
    }
    if (nextInstructorId && unavailableInstructorIds.includes(nextInstructorId)) {
      return NextResponse.json(
        { error: "Selected instructor is no longer available for this time range." },
        { status: 409, headers: { "cache-control": "no-store" } }
      )
    }

    if ("start_time" in payload.data) {
      updatePayload.start_time = nextStartDate.toISOString()
    }
    if ("end_time" in payload.data) {
      updatePayload.end_time = nextEndDate.toISOString()
    }
    if ("aircraft_id" in payload.data) {
      updatePayload.aircraft_id = nextAircraftId
    }
    if ("instructor_id" in payload.data) {
      updatePayload.instructor_id = nextInstructorId
    }
  }

  const { data, error } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select(BOOKING_SELECT)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to update booking" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const booking = data as Record<string, unknown>

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, logo_url, contact_email, timezone")
      .eq("id", tenantId)
      .maybeSingle()

    const bookingUpdatedChanges = buildBookingUpdatedChanges(
      toComparableBooking(existing as Parameters<typeof toComparableBooking>[0]),
      toComparableBooking(booking as Parameters<typeof toComparableBooking>[0])
    )

    if (nextStatus === "confirmed") {
      const bookingForEmail = {
        ...booking,
        start_time: booking.start_time ?? existing.start_time,
        end_time: booking.end_time ?? existing.end_time,
      }
      await sendBookingConfirmedEmailForBooking({
        supabase,
        tenantId,
        bookingId: id,
        bookingUserId: existing.user_id,
        triggeredBy: user.id,
        booking: bookingForEmail,
        tenant,
      })
    }

    if (nextStatus === "cancelled") {
      await sendBookingCancelledEmailForBooking({
        supabase,
        tenantId,
        bookingId: id,
        bookingUserId: existing.user_id,
        triggeredBy: user.id,
        booking,
        tenant,
      })
    }

    if (bookingUpdatedChanges.length > 0) {
      await sendBookingUpdatedEmailForBooking({
        supabase,
        tenantId,
        bookingId: id,
        bookingUserId: existing.user_id,
        triggeredBy: user.id,
        booking,
        tenant,
        changes: bookingUpdatedChanges,
      })
    }
  } catch (emailErr) {
    logError("[email] Trigger send failed (non-fatal)", { error: emailErr, tenantId, bookingId: id })
  }

  return NextResponse.json(
    { booking: data },
    { headers: { "cache-control": "no-store" } }
  )
}
