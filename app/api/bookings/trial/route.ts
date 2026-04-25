import { randomUUID } from "crypto"

import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchUnavailableResourceIds } from "@/lib/bookings/resource-availability"
import {
  isDisallowedTrialGuestEmail,
  trialGuestNameConflictsWithExistingUser,
} from "@/lib/bookings/trial-guest-email"
import { logError, logWarn } from "@/lib/security/logger"
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getZonedYyyyMmDdAndHHmm } from "@/lib/utils/timezone"

export const dynamic = "force-dynamic"

const trialBookingSchema = z.strictObject({
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

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const ctx = await getTenantStaffRouteContext(supabase)
  if (ctx.response) return ctx.response
  const { user, tenantId } = ctx.context

  const parsed = trialBookingSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid payload"
    return noStoreJson({ error: firstError }, { status: 400 })
  }

  const payload = parsed.data
  const startDate = new Date(payload.start_time)
  const endDate = new Date(payload.end_time)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
    return noStoreJson({ error: "Invalid booking time range" }, { status: 400 })
  }

  if (payload.aircraft_id) {
    const { data: aircraft, error: aircraftError } = await supabase
      .from("aircraft")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", payload.aircraft_id)
      .is("voided_at", null)
      .eq("on_line", true)
      .maybeSingle()

    if (aircraftError || !aircraft) {
      return noStoreJson({ error: "Selected aircraft was not found" }, { status: 404 })
    }
  }

  if (payload.instructor_id) {
    const { data: instructor, error: instructorError } = await supabase
      .from("instructors")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", payload.instructor_id)
      .is("voided_at", null)
      .eq("is_actively_instructing", true)
      .maybeSingle()

    if (instructorError || !instructor) {
      return noStoreJson({ error: "Selected instructor was not found" }, { status: 404 })
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
      return noStoreJson({ error: "Selected flight type was not found" }, { status: 404 })
    }
  }

  const { unavailableAircraftIds, unavailableInstructorIds } = await fetchUnavailableResourceIds({
    supabase,
    tenantId,
    startTimeIso: startDate.toISOString(),
    endTimeIso: endDate.toISOString(),
  })

  if (payload.aircraft_id && unavailableAircraftIds.includes(payload.aircraft_id)) {
    return noStoreJson(
      { error: "Selected aircraft is no longer available for this time range." },
      { status: 409 }
    )
  }
  if (payload.instructor_id && unavailableInstructorIds.includes(payload.instructor_id)) {
    return noStoreJson(
      { error: "Selected instructor is no longer available for this time range." },
      { status: 409 }
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
    const dateStr = getZonedYyyyMmDdAndHHmm(startDate, tz).yyyyMmDd

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
        return noStoreJson(
          { error: "Booking falls outside the instructor's rostered availability." },
          { status: 409 }
        )
      }
    }
  }

  const admin = createPrivilegedSupabaseClient("trial booking guest provisioning and tenant linking")
  const normalizedEmail = payload.guest_email.toLowerCase()
  if (isDisallowedTrialGuestEmail(normalizedEmail)) {
    return noStoreJson(
      {
        error:
          "That email is not valid for a trial guest. Use the guest’s real address (not a placeholder or example.com test address).",
      },
      { status: 400 }
    )
  }
  const { data: studentRole, error: studentRoleError } = await admin
    .from("roles")
    .select("id")
    .eq("name", "student")
    .eq("is_active", true)
    .maybeSingle()

  if (studentRoleError || !studentRole) {
    logError("[trial-booking] unable to resolve student role", {
      error: studentRoleError?.message ?? "student_role_not_found",
      tenantId,
    })
    return noStoreJson({ error: "Booking configuration is incomplete" }, { status: 500 })
  }

  const { data: existingUser, error: lookupError } = await admin
    .from("users")
    .select("id, first_name, last_name")
    .eq("email", normalizedEmail)
    .maybeSingle()

  if (lookupError) {
    logError("[trial-booking] user lookup error", { error: lookupError.message, tenantId })
  }

  let guestUserId: string

  if (existingUser) {
    if (
      trialGuestNameConflictsWithExistingUser(
        payload.guest_first_name,
        payload.guest_last_name,
        existingUser.first_name,
        existingUser.last_name
      )
    ) {
      logWarn("[trial-booking] email matches existing user but name does not; refusing to attach booking", {
        tenantId,
        existingUserId: existingUser.id,
      })
      return noStoreJson(
        {
          error:
            "A profile with this email already exists under a different name. Use that person’s name, or a different email with no duplicate, so the booking is not assigned to the wrong student.",
        },
        { status: 409 }
      )
    }
    guestUserId = existingUser.id
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
      logError("[trial-booking] user insert error", {
        error: userError?.message ?? "user_insert_failed",
        details: userError?.details,
        code: userError?.code,
        tenantId,
      })
      return noStoreJson({ error: "Failed to create guest user record" }, { status: 500 })
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
    logError("[trial-booking] tenant_user lookup error", { error: tenantLookupError.message, tenantId, userId: guestUserId })
  }

  if (!existingTenantUser) {
    const { error: tenantUserError } = await admin
      .from("tenant_users")
      .insert({
        tenant_id: tenantId,
        user_id: guestUserId,
        role_id: studentRole.id,
        granted_by: user.id,
      })

    if (tenantUserError) {
      logError("[trial-booking] tenant_user insert error", {
        error: tenantUserError.message,
        details: tenantUserError.details,
        code: tenantUserError.code,
        tenantId,
        userId: guestUserId,
      })
      return noStoreJson({ error: "Failed to link guest to organisation" }, { status: 500 })
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
    logError("[trial-booking] booking insert error", {
      error: error?.message ?? "booking_insert_failed",
      details: error?.details,
      code: error?.code,
      tenantId,
      userId: guestUserId,
    })
    return noStoreJson({ error: "Failed to create trial flight booking" }, { status: 500 })
  }

  return noStoreJson({ booking: data, guestUserId }, { status: 201 })
}
