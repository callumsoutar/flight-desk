import { NextResponse } from "next/server"
import { z } from "zod"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { sendBookingConfirmedEmailForBooking } from "@/lib/email/send-booking-confirmed-for-booking"
import { invalidPayloadResponse } from "@/lib/security/http"
import { logError } from "@/lib/security/logger"
import { enforceRateLimit } from "@/lib/security/rate-limit"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const BOOKING_SELECT =
  "*, student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), checked_out_instructor:instructors!bookings_checked_out_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(id, registration, type, model, manufacturer, current_hobbs, current_tach), checked_out_aircraft:aircraft!bookings_checked_out_aircraft_id_fkey(id, registration, type, model, manufacturer, current_hobbs, current_tach), flight_type:flight_types!bookings_flight_type_id_fkey(id, name, instruction_type), lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id), lesson_progress(*)"

export const dynamic = "force-dynamic"

const paramsSchema = z.strictObject({
  id: z.string().uuid(),
})

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
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
  if (!isStaffRole(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const parsedParams = paramsSchema.safeParse(await context.params)
  if (!parsedParams.success) {
    return invalidPayloadResponse()
  }
  const { id } = parsedParams.data

  const rateLimitResult = enforceRateLimit({
    key: `email:send-booking-confirmation:${tenantId}:${user.id}`,
    limit: 20,
    windowMs: 60_000,
  })
  if (!rateLimitResult.ok) {
    return NextResponse.json(
      { error: "Too many email requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "cache-control": "no-store",
          "retry-after": String(rateLimitResult.retryAfterSeconds),
        },
      }
    )
  }

  const { data: booking, error } = await supabase
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
  if (!booking) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, logo_url, contact_email, timezone")
    .eq("id", tenantId)
    .maybeSingle()

  try {
    const result = await sendBookingConfirmedEmailForBooking({
      supabase,
      tenantId,
      bookingId: id,
      bookingUserId: booking.user_id,
      triggeredBy: user.id,
      booking: booking as Record<string, unknown>,
      tenant,
    })

    if (!result.sent) {
      const message =
        result.reason === "trigger_disabled"
          ? "Booking confirmation emails are disabled in email settings"
          : "Member has no email address on file"
      return NextResponse.json(
        { error: message },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
  } catch (e) {
    logError("[email] Manual booking confirmation send failed", { error: e, tenantId, bookingId: id })
    return NextResponse.json(
      { error: "Failed to send confirmation email" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
