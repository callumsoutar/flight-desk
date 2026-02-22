import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { fetchUnavailableResourceIds } from "@/lib/bookings/resource-availability"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { BookingStatus } from "@/lib/types/bookings"

const BOOKING_SELECT =
  "*, student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(id, registration, type, model, manufacturer), flight_type:flight_types!bookings_flight_type_id_fkey(id, name, instruction_type), lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id)"

const patchSchema = z.object({
  status: z
    .enum(["unconfirmed", "confirmed", "briefing", "flying", "complete", "cancelled"])
    .optional(),
  cancellation_reason: z.string().nullable().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  aircraft_id: z.string().uuid().nullable().optional(),
  instructor_id: z.string().uuid().nullable().optional(),
})

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
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
      { error: "Tenant not found" },
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

  if (!isStaff(role) && data.user_id !== user.id) {
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
      { error: "Tenant not found" },
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
    .select("id, user_id, status, start_time, end_time, aircraft_id, instructor_id")
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

  const staff = isStaff(role)
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

  const hasScheduleChange =
    "start_time" in payload.data ||
    "end_time" in payload.data ||
    "aircraft_id" in payload.data ||
    "instructor_id" in payload.data

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

  const updatePayload: {
    status?: BookingStatus
    cancellation_reason?: string | null
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
    updatePayload.cancelled_at = new Date().toISOString()
    updatePayload.cancelled_by = user.id
    if ("cancellation_reason" in payload.data) {
      updatePayload.cancellation_reason = payload.data.cancellation_reason ?? null
    }
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

    if (nextAircraftId) {
      const { data: aircraft, error: aircraftError } = await supabase
        .from("aircraft")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("id", nextAircraftId)
        .eq("on_line", true)
        .maybeSingle()

      if (aircraftError || !aircraft) {
        return NextResponse.json(
          { error: "Selected aircraft was not found" },
          { status: 404, headers: { "cache-control": "no-store" } }
        )
      }
    }

    if (nextInstructorId) {
      const { data: instructor, error: instructorError } = await supabase
        .from("instructors")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("id", nextInstructorId)
        .eq("is_actively_instructing", true)
        .maybeSingle()

      if (instructorError || !instructor) {
        return NextResponse.json(
          { error: "Selected instructor was not found" },
          { status: 404, headers: { "cache-control": "no-store" } }
        )
      }
    }

    const { unavailableAircraftIds, unavailableInstructorIds } = await fetchUnavailableResourceIds({
      supabase,
      tenantId,
      startTimeIso: nextStartDate.toISOString(),
      endTimeIso: nextEndDate.toISOString(),
      excludeBookingId: id,
    })

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

  return NextResponse.json(
    { booking: data },
    { headers: { "cache-control": "no-store" } }
  )
}
