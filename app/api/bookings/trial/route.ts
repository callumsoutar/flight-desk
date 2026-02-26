import { randomUUID } from "crypto"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { fetchUnavailableResourceIds } from "@/lib/bookings/resource-availability"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const STUDENT_ROLE_ID = "9ac4dbd5-648d-4f9a-8c13-4307aae0da40"

const trialBookingSchema = z.object({
  guest_first_name: z.string().trim().min(1, "First name is required"),
  guest_last_name: z.string().trim().min(1, "Last name is required"),
  guest_email: z.string().trim().email("Valid email is required"),
  guest_phone: z.string().trim().optional(),
  voucher_number: z.string().trim().optional(),
  start_time: z.string(),
  end_time: z.string(),
  aircraft_id: z.string().uuid().nullable(),
  instructor_id: z.string().uuid().nullable(),
  flight_type_id: z.string().uuid().nullable().optional(),
  purpose: z.string().trim().min(1, "Purpose is required"),
  remarks: z.string().trim().nullable().optional(),
  status: z.enum(["unconfirmed", "confirmed"]).optional(),
})

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
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
  if (!isStaff(role)) {
    return NextResponse.json(
      { error: "Only staff can create trial flight bookings" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const parsed = trialBookingSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid payload"
    return NextResponse.json(
      { error: firstError },
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

  if (payload.instructor_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("timezone")
      .eq("id", tenantId)
      .maybeSingle()

    const tz = tenant?.timezone ?? "Pacific/Auckland"
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })

    const startParts = fmt.formatToParts(startDate)
    const endParts = fmt.formatToParts(endDate)

    const getMinutes = (parts: Intl.DateTimeFormatPart[]) => {
      const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0")
      const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0")
      return h * 60 + m
    }
    const getDow = (parts: Intl.DateTimeFormatPart[]) => {
      const dayName = parts.find((p) => p.type === "weekday")?.value ?? ""
      const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
      return map[dayName] ?? 0
    }

    const bookingDow = getDow(startParts)
    const bookingStartMin = getMinutes(startParts)
    const bookingEndMin = getMinutes(endParts)
    const dateStr = startDate.toLocaleDateString("sv-SE", { timeZone: tz })

    const { data: rosterRules } = await supabase
      .from("roster_rules")
      .select("start_time, end_time")
      .eq("tenant_id", tenantId)
      .eq("instructor_id", payload.instructor_id)
      .eq("day_of_week", bookingDow)
      .eq("is_active", true)
      .is("voided_at", null)
      .lte("effective_from", dateStr)
      .or(`effective_until.is.null,effective_until.gte.${dateStr}`)

    if (rosterRules && rosterRules.length > 0) {
      const parseHHmm = (v: string) => {
        const [hh, mm] = v.split(":")
        return Number(hh) * 60 + Number(mm)
      }

      const fitsInAnyWindow = rosterRules.some((rule) => {
        const ruleStart = parseHHmm(rule.start_time)
        const ruleEnd = parseHHmm(rule.end_time)
        return bookingStartMin >= ruleStart && bookingEndMin <= ruleEnd
      })

      if (!fitsInAnyWindow) {
        return NextResponse.json(
          { error: "Booking falls outside the instructor\u2019s rostered availability." },
          { status: 409, headers: { "cache-control": "no-store" } }
        )
      }
    }
  }

  const admin = createSupabaseAdminClient()
  const normalizedEmail = payload.guest_email.toLowerCase()

  const { data: existingUser, error: lookupError } = await admin
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle()

  if (lookupError) {
    console.error("[trial-booking] user lookup error:", lookupError.message)
  }

  let guestUserId: string

  if (existingUser) {
    guestUserId = existingUser.id

    const { error: updateError } = await admin
      .from("users")
      .update({
        first_name: payload.guest_first_name,
        last_name: payload.guest_last_name,
        phone: payload.guest_phone || null,
      })
      .eq("id", guestUserId)

    if (updateError) {
      console.error("[trial-booking] user update error:", updateError.message)
    }
  } else {
    const newId = randomUUID()
    const { data: newUser, error: userError } = await admin
      .from("users")
      .insert({
        id: newId,
        email: normalizedEmail,
        first_name: payload.guest_first_name,
        last_name: payload.guest_last_name,
        phone: payload.guest_phone || null,
      })
      .select("id")
      .single()

    if (userError || !newUser) {
      console.error("[trial-booking] user insert error:", userError?.message, userError?.details, userError?.code)
      return NextResponse.json(
        { error: userError?.message || "Failed to create guest user record" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    guestUserId = newUser.id
  }

  const { data: existingTenantUser, error: tenantLookupError } = await admin
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", guestUserId)
    .maybeSingle()

  if (tenantLookupError) {
    console.error("[trial-booking] tenant_user lookup error:", tenantLookupError.message)
  }

  if (!existingTenantUser) {
    const { error: tenantUserError } = await admin
      .from("tenant_users")
      .insert({
        tenant_id: tenantId,
        user_id: guestUserId,
        role_id: STUDENT_ROLE_ID,
        granted_by: user.id,
      })

    if (tenantUserError) {
      console.error("[trial-booking] tenant_user insert error:", tenantUserError.message, tenantUserError.details, tenantUserError.code)
      return NextResponse.json(
        { error: tenantUserError.message || "Failed to link guest to organisation" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }
  }

  const resolvedStatus = payload.status ?? "unconfirmed"

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      tenant_id: tenantId,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      aircraft_id: payload.aircraft_id,
      user_id: guestUserId,
      instructor_id: payload.instructor_id,
      flight_type_id: payload.flight_type_id ?? null,
      booking_type: "flight" as const,
      purpose: payload.purpose.trim(),
      remarks: payload.remarks ?? null,
      voucher_number: payload.voucher_number || null,
      status: resolvedStatus,
    })
    .select("id")
    .single()

  if (error || !data) {
    console.error("[trial-booking] booking insert error:", error?.message, error?.details, error?.code)
    return NextResponse.json(
      { error: error?.message || "Failed to create trial flight booking" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { booking: data, guestUserId },
    { status: 201, headers: { "cache-control": "no-store" } }
  )
}
