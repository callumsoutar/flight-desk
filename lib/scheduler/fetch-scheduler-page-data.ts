import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { dayOfWeekFromYyyyMmDd, zonedDayRangeUtcIso } from "@/lib/utils/timezone"
import type { Database } from "@/lib/types"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type {
  SchedulerBusinessHours,
  SchedulerInstructor,
  SchedulerPageData,
  SchedulerRosterRule,
} from "@/lib/types/scheduler"

const BOOKING_SELECT =
  "*, student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(id, registration, type, model, manufacturer), flight_type:flight_types!bookings_flight_type_id_fkey(id, name, instruction_type), lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id)"

const DEFAULT_BUSINESS_HOURS: SchedulerBusinessHours = {
  openTime: "07:00",
  closeTime: "19:00",
  is24Hours: false,
  isClosed: false,
}

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function normalizeTimeHHmm(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback
  const [hh, mm] = value.trim().split(":")
  const hour = Number(hh)
  const minute = Number(mm)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function parseBusinessHours(settings: unknown): SchedulerBusinessHours {
  if (!settings || typeof settings !== "object") return DEFAULT_BUSINESS_HOURS

  const data = settings as Record<string, unknown>
  return {
    openTime: normalizeTimeHHmm(data.business_open_time, DEFAULT_BUSINESS_HOURS.openTime),
    closeTime: normalizeTimeHHmm(data.business_close_time, DEFAULT_BUSINESS_HOURS.closeTime),
    is24Hours:
      typeof data.business_is_24_hours === "boolean"
        ? data.business_is_24_hours
        : DEFAULT_BUSINESS_HOURS.is24Hours,
    isClosed:
      typeof data.business_is_closed === "boolean"
        ? data.business_is_closed
        : DEFAULT_BUSINESS_HOURS.isClosed,
  }
}

function getInstructorDisplayName(instructor: SchedulerInstructor) {
  const firstName = instructor.user?.first_name ?? instructor.first_name
  const lastName = instructor.user?.last_name ?? instructor.last_name
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
  return fullName || instructor.user?.email || "Unnamed instructor"
}

export async function fetchSchedulerPageData({
  supabase,
  tenantId,
  dateYyyyMmDd,
  timeZone,
}: {
  supabase: SupabaseClient<Database>
  tenantId: string
  dateYyyyMmDd: string
  timeZone: string
}): Promise<SchedulerPageData> {
  const { startUtcIso, endUtcIso } = zonedDayRangeUtcIso({
    dateYyyyMmDd,
    timeZone,
  })
  const dayOfWeek = dayOfWeekFromYyyyMmDd(dateYyyyMmDd)

  const [bookingsResult, aircraftResult, rosterRulesResult, tenantSettingsResult] = await Promise.all([
    supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("tenant_id", tenantId)
      .lt("start_time", endUtcIso)
      .gt("end_time", startUtcIso)
      .order("start_time", { ascending: true }),
    supabase
      .from("aircraft")
      .select("*, aircraft_type:aircraft_types(id, name, category)")
      .eq("tenant_id", tenantId)
      .eq("on_line", true)
      .order("order", { ascending: true })
      .order("registration", { ascending: true }),
    supabase
      .from("roster_rules")
      .select(
        "id, instructor_id, day_of_week, start_time, end_time, effective_from, effective_until, is_active, voided_at"
      )
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .is("voided_at", null)
      .eq("day_of_week", dayOfWeek)
      .lte("effective_from", dateYyyyMmDd)
      .or(`effective_until.is.null,effective_until.gte.${dateYyyyMmDd}`),
    supabase
      .from("tenant_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ])

  if (bookingsResult.error) throw bookingsResult.error
  if (aircraftResult.error) throw aircraftResult.error
  if (rosterRulesResult.error) throw rosterRulesResult.error
  if (tenantSettingsResult.error) throw tenantSettingsResult.error

  const bookings = (bookingsResult.data ?? []) as BookingWithRelations[]
  const aircraft = (aircraftResult.data ?? []) as AircraftWithType[]
  const rosterRules = (rosterRulesResult.data ?? []) as SchedulerRosterRule[]
  const businessHours = parseBusinessHours(tenantSettingsResult.data?.settings)

  const rosterRulesByInstructor = new Map<string, SchedulerRosterRule[]>()
  for (const rule of rosterRules) {
    const existing = rosterRulesByInstructor.get(rule.instructor_id)
    if (existing) {
      existing.push(rule)
      continue
    }
    rosterRulesByInstructor.set(rule.instructor_id, [rule])
  }

  const instructorIds = [...rosterRulesByInstructor.keys()]
  let instructors: SchedulerInstructor[] = []

  if (instructorIds.length > 0) {
    const instructorsResult = await supabase
      .from("instructors")
      .select(
        "id, first_name, last_name, user_id, status, is_actively_instructing, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)"
      )
      .eq("tenant_id", tenantId)
      .in("id", instructorIds)

    if (instructorsResult.error) throw instructorsResult.error

    instructors = (instructorsResult.data ?? []).map((row) => {
      const user = pickMaybeOne(row.user)
      return {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        user_id: row.user_id,
        status: row.status,
        is_actively_instructing: row.is_actively_instructing,
        user: user
          ? {
              id: user.id,
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email,
            }
          : null,
        roster_rules: rosterRulesByInstructor.get(row.id) ?? [],
      } as SchedulerInstructor
    })

    instructors.sort((a, b) => getInstructorDisplayName(a).localeCompare(getInstructorDisplayName(b)))
  }

  return {
    dateYyyyMmDd,
    timeZone,
    rangeStartUtcIso: startUtcIso,
    rangeEndUtcIso: endUtcIso,
    businessHours,
    bookings,
    aircraft,
    instructors,
  }
}
