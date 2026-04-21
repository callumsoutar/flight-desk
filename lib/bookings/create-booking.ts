import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import type { AuthUser } from "@/lib/auth/session"
import { fetchUnavailableResourceIds } from "@/lib/bookings/resource-availability"
import { logError } from "@/lib/security/logger"
import type { Database } from "@/lib/types"
import type { BookingStatus } from "@/lib/types/bookings"
import type { UserRole } from "@/lib/types/roles"
import { getZonedYyyyMmDdAndHHmm, minBookableWallClockMinutesFromNow, zonedTodayYyyyMmDd } from "@/lib/utils/timezone"

export const createBookingPayloadSchema = z.strictObject({
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

const BOOKING_WITH_RELATIONS_SELECT =
  "*, student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(id, registration, type, model, manufacturer), flight_type:flight_types!bookings_flight_type_id_fkey(id, name, instruction_type), lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id)"

function isStaffRole(role: UserRole | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

export type CreateBookingResult =
  | { ok: true; booking: unknown }
  | { ok: false; status: number; error: string }

export async function createBookingInTenant({
  supabase,
  tenantId,
  user,
  role,
  payload,
}: {
  supabase: SupabaseClient<Database>
  tenantId: string
  user: AuthUser
  role: UserRole | null
  payload: z.infer<typeof createBookingPayloadSchema>
}): Promise<CreateBookingResult> {
  try {
    const startDate = new Date(payload.start_time)
    const endDate = new Date(payload.end_time)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
      return { ok: false, status: 400, error: "Invalid booking time range" }
    }

    let tenantTimeZone: string | null = null
    const resolveTenantTimeZone = async () => {
      if (tenantTimeZone !== null) return tenantTimeZone
      const { data } = await supabase.from("tenants").select("timezone").eq("id", tenantId).maybeSingle()
      tenantTimeZone = data?.timezone ?? "Pacific/Auckland"
      return tenantTimeZone
    }

    const staff = isStaffRole(role)
    if (!staff && payload.user_id && payload.user_id !== user.id) {
      return { ok: false, status: 403, error: "You can only create bookings for yourself" }
    }

    if (!staff) {
      const tz = await resolveTenantTimeZone()
      const bookingDateKey = getZonedYyyyMmDdAndHHmm(startDate, tz).yyyyMmDd
      const todayKey = zonedTodayYyyyMmDd(tz)
      if (bookingDateKey < todayKey) {
        return { ok: false, status: 400, error: "You cannot create bookings in the past." }
      }
      if (bookingDateKey === todayKey) {
        const minStartMin = minBookableWallClockMinutesFromNow({
          dateYyyyMmDd: bookingDateKey,
          timeZone: tz,
          intervalMinutes: 30,
        })
        if (minStartMin === null) {
          return { ok: false, status: 400, error: "No more booking slots are available today." }
        }
        const { hhmm } = getZonedYyyyMmDdAndHHmm(startDate, tz)
        const [h, m] = hhmm.split(":").map(Number)
        const startMin = h * 60 + m
        if (startMin < minStartMin) {
          return {
            ok: false,
            status: 400,
            error: "Start time must be the next available 30-minute slot from the current time.",
          }
        }
      }
    }

    const resolvedUserId = staff ? (payload.user_id ?? null) : user.id
    const resolvedStatus = payload.status ?? "unconfirmed"

    if (resolvedStatus === "confirmed" && !staff) {
      return { ok: false, status: 403, error: "Only staff can create confirmed bookings." }
    }

    const [aircraftCheck, instructorCheck, memberCheck, flightTypeCheck, lessonCheck] =
      await Promise.all([
        payload.aircraft_id
          ? supabase
              .from("aircraft")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("id", payload.aircraft_id)
              .is("voided_at", null)
              .eq("on_line", true)
              .maybeSingle()
          : Promise.resolve({ data: true, error: null }),
        payload.instructor_id
          ? supabase
              .from("instructors")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("id", payload.instructor_id)
              .is("voided_at", null)
              .eq("is_actively_instructing", true)
              .maybeSingle()
          : Promise.resolve({ data: true, error: null }),
        resolvedUserId
          ? supabase
              .from("tenant_users")
              .select("user_id")
              .eq("tenant_id", tenantId)
              .eq("user_id", resolvedUserId)
              .eq("is_active", true)
              .maybeSingle()
          : Promise.resolve({ data: true, error: null }),
        payload.flight_type_id
          ? supabase
              .from("flight_types")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("id", payload.flight_type_id)
              .eq("is_active", true)
              .is("voided_at", null)
              .maybeSingle()
          : Promise.resolve({ data: true, error: null }),
        payload.lesson_id
          ? supabase
              .from("lessons")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("id", payload.lesson_id)
              .eq("is_active", true)
              .maybeSingle()
          : Promise.resolve({ data: true, error: null }),
      ])

    if (aircraftCheck.error || !aircraftCheck.data) {
      return { ok: false, status: 404, error: "Selected aircraft was not found" }
    }
    if (instructorCheck.error || !instructorCheck.data) {
      return { ok: false, status: 404, error: "Selected instructor was not found" }
    }
    if (memberCheck.error || !memberCheck.data) {
      return { ok: false, status: 404, error: "Selected member was not found" }
    }
    if (flightTypeCheck.error || !flightTypeCheck.data) {
      return { ok: false, status: 404, error: "Selected flight type was not found" }
    }
    if (lessonCheck.error || !lessonCheck.data) {
      return { ok: false, status: 404, error: "Selected lesson was not found" }
    }

    const { unavailableAircraftIds, unavailableInstructorIds } = await fetchUnavailableResourceIds({
      supabase,
      tenantId,
      startTimeIso: startDate.toISOString(),
      endTimeIso: endDate.toISOString(),
    })

    if (payload.aircraft_id && unavailableAircraftIds.includes(payload.aircraft_id)) {
      return {
        ok: false,
        status: 409,
        error: "Selected aircraft is no longer available for this time range.",
      }
    }
    if (payload.instructor_id && unavailableInstructorIds.includes(payload.instructor_id)) {
      return {
        ok: false,
        status: 409,
        error: "Selected instructor is no longer available for this time range.",
      }
    }

    if (payload.instructor_id) {
      const tz = await resolveTenantTimeZone()
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })

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

      const { data: rosterRules, error: rosterRulesError } = await supabase
        .from("roster_rules")
        .select("start_time, end_time")
        .eq("tenant_id", tenantId)
        .eq("instructor_id", payload.instructor_id)
        .eq("day_of_week", bookingDow)
        .eq("is_active", true)
        .is("voided_at", null)
        .lte("effective_from", dateStr)
        .or(`effective_until.is.null,effective_until.gte.${dateStr}`)

      if (rosterRulesError) {
        return { ok: false, status: 500, error: "Failed to create booking" }
      }

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
          return {
            ok: false,
            status: 409,
            error: "Booking falls outside the instructor’s rostered availability.",
          }
        }
      }
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
        status: resolvedStatus as BookingStatus,
      })
      .select(BOOKING_WITH_RELATIONS_SELECT)
      .maybeSingle()

    if (error || !data) {
      return { ok: false, status: 500, error: "Failed to create booking" }
    }

    return { ok: true, booking: data }
  } catch (error) {
    logError("[bookings] Failed to create booking", { error, tenantId, userId: user.id })
    return { ok: false, status: 500, error: "Failed to create booking" }
  }
}
