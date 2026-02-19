import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { fetchUnavailableResourceIds } from "@/lib/bookings/resource-availability"
import { fetchBookings } from "@/lib/bookings/fetch-bookings"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { BookingStatus } from "@/lib/types/bookings"

export const dynamic = "force-dynamic"

const ALLOWED_STATUSES: BookingStatus[] = [
  "unconfirmed",
  "confirmed",
  "briefing",
  "flying",
  "complete",
  "cancelled",
]

const createBookingSchema = z.object({
  start_time: z.string(),
  end_time: z.string(),
  aircraft_id: z.string().uuid().nullable(),
  user_id: z.string().uuid().nullable().optional(),
  instructor_id: z.string().uuid().nullable(),
  flight_type_id: z.string().uuid().nullable().optional(),
  lesson_id: z.string().uuid().nullable().optional(),
  booking_type: z.enum(["flight", "groundwork", "maintenance", "other"]),
  purpose: z.string().trim().min(1, "Purpose is required"),
  remarks: z.string().trim().nullable().optional(),
  status: z.enum(["unconfirmed", "confirmed"]).optional(),
})

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

export async function GET(request: NextRequest) {
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

  const userIdParam = request.nextUrl.searchParams.get("user_id")
  const targetUserId = userIdParam ?? user.id

  const canViewOtherMembers = role === "owner" || role === "admin" || role === "instructor"
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const statusParam = request.nextUrl.searchParams.get("status")
  const parsedStatuses = (statusParam ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean) as BookingStatus[]

  const statuses = parsedStatuses.filter((status): status is BookingStatus =>
    ALLOWED_STATUSES.includes(status)
  )

  try {
    const bookings = await fetchBookings(supabase, tenantId, {
      user_id: targetUserId,
      status: statuses.length > 0 ? statuses : undefined,
    })

    return NextResponse.json(
      { bookings },
      { headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to load bookings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

export async function POST(request: NextRequest) {
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

  const parsed = createBookingSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const payload = parsed.data
  const startDate = new Date(payload.start_time)
  const endDate = new Date(payload.end_time)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
    return NextResponse.json(
      { error: "Invalid booking time range" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const staff = isStaff(role)
  if (!staff && payload.user_id && payload.user_id !== user.id) {
    return NextResponse.json(
      { error: "You can only create bookings for yourself" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const resolvedUserId = staff ? (payload.user_id ?? null) : user.id
  const resolvedStatus = payload.status ?? "unconfirmed"

  if (resolvedStatus === "confirmed" && !staff) {
    return NextResponse.json(
      { error: "Only staff can create confirmed bookings." },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  if (payload.aircraft_id) {
    const { data: aircraft, error: aircraftError } = await supabase
      .from("aircraft")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", payload.aircraft_id)
      .eq("on_line", true)
      .maybeSingle()

    if (aircraftError || !aircraft) {
      return NextResponse.json(
        { error: "Selected aircraft was not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }
  }

  if (payload.instructor_id) {
    const { data: instructor, error: instructorError } = await supabase
      .from("instructors")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", payload.instructor_id)
      .eq("is_actively_instructing", true)
      .maybeSingle()

    if (instructorError || !instructor) {
      return NextResponse.json(
        { error: "Selected instructor was not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }
  }

  if (resolvedUserId) {
    const { data: member, error: memberError } = await supabase
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", resolvedUserId)
      .eq("is_active", true)
      .maybeSingle()

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Selected member was not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }
  }

  if (payload.flight_type_id) {
    const { data: flightType, error: flightTypeError } = await supabase
      .from("flight_types")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", payload.flight_type_id)
      .eq("is_active", true)
      .is("voided_at", null)
      .maybeSingle()

    if (flightTypeError || !flightType) {
      return NextResponse.json(
        { error: "Selected flight type was not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }
  }

  if (payload.lesson_id) {
    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", payload.lesson_id)
      .eq("is_active", true)
      .maybeSingle()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { error: "Selected lesson was not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }
  }

  const { unavailableAircraftIds, unavailableInstructorIds } = await fetchUnavailableResourceIds({
    supabase,
    tenantId,
    startTimeIso: startDate.toISOString(),
    endTimeIso: endDate.toISOString(),
  })

  if (payload.aircraft_id && unavailableAircraftIds.includes(payload.aircraft_id)) {
    return NextResponse.json(
      { error: "Selected aircraft is no longer available for this time range." },
      { status: 409, headers: { "cache-control": "no-store" } }
    )
  }
  if (payload.instructor_id && unavailableInstructorIds.includes(payload.instructor_id)) {
    return NextResponse.json(
      { error: "Selected instructor is no longer available for this time range." },
      { status: 409, headers: { "cache-control": "no-store" } }
    )
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      tenant_id: tenantId,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      aircraft_id: payload.aircraft_id,
      user_id: resolvedUserId,
      instructor_id: payload.instructor_id,
      flight_type_id: payload.flight_type_id ?? null,
      lesson_id: payload.lesson_id ?? null,
      booking_type: payload.booking_type,
      purpose: payload.purpose.trim(),
      remarks: payload.remarks ?? null,
      status: resolvedStatus,
    })
    .select(
      "*, student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(id, registration, type, model, manufacturer), flight_type:flight_types!bookings_flight_type_id_fkey(id, name, instruction_type), lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id)"
    )
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { booking: data },
    { status: 201, headers: { "cache-control": "no-store" } }
  )
}
