import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { BookingStatus } from "@/lib/types/bookings"

const BOOKING_SELECT =
  "*, student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(id, registration, type, model, manufacturer), flight_type:flight_types!bookings_flight_type_id_fkey(id, name, instruction_type), lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id)"

const patchSchema = z.object({
  status: z
    .enum(["unconfirmed", "confirmed", "briefing", "flying", "complete", "cancelled"])
    .optional(),
  cancellation_reason: z.string().nullable().optional(),
})

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }

  const tenantId = await getUserTenantId(supabase, user.id)
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
  const { user, role } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }

  const tenantId = await getUserTenantId(supabase, user.id)
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
    .select("id, user_id, status")
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

  const updatePayload: {
    status?: BookingStatus
    cancellation_reason?: string | null
    cancelled_at?: string | null
    cancelled_by?: string | null
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
