import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { parseTimeToMinutes } from "@/lib/roster/availability"
import type { Database, Json } from "@/lib/types"
import type { RosterInstructor, RosterPageData, RosterRule, TimelineConfig } from "@/lib/types/roster"

const DEFAULT_TIMELINE_CONFIG: TimelineConfig = {
  startHour: 9,
  endHour: 17,
  intervalMinutes: 30,
}

type JsonObject = Record<string, Json>

function isJsonObject(value: Json | null | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function extractSettingsContainer(settings: Json | null) {
  if (!isJsonObject(settings)) return null
  const general = settings.general

  if (isJsonObject(general)) {
    return general
  }

  return settings
}

function readStringSetting(settings: Json | null, key: string, fallback: string) {
  const container = extractSettingsContainer(settings)
  const value = container?.[key]
  return typeof value === "string" ? value : fallback
}

function readBooleanSetting(settings: Json | null, key: string, fallback: boolean) {
  const container = extractSettingsContainer(settings)
  const value = container?.[key]
  return typeof value === "boolean" ? value : fallback
}

function buildTimelineConfig(settings: Json | null): TimelineConfig {
  const openTime = readStringSetting(settings, "business_open_time", "09:00:00")
  const closeTime = readStringSetting(settings, "business_close_time", "17:00:00")
  const is24Hours = readBooleanSetting(settings, "business_is_24_hours", false)
  const isClosed = readBooleanSetting(settings, "business_is_closed", false)

  if (isClosed || is24Hours) {
    return {
      startHour: 0,
      endHour: 24,
      intervalMinutes: 30,
    }
  }

  const openMinutes = parseTimeToMinutes(openTime)
  const closeMinutes = parseTimeToMinutes(closeTime)

  if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) {
    return {
      startHour: 6,
      endHour: 22,
      intervalMinutes: 30,
    }
  }

  const startHour = Math.floor(openMinutes / 60)
  const endHour = Math.ceil(closeMinutes / 60)

  if (startHour < 0 || startHour > 23 || endHour <= startHour || endHour > 24) {
    return DEFAULT_TIMELINE_CONFIG
  }

  return {
    startHour,
    endHour,
    intervalMinutes: 30,
  }
}

function getInstructorDisplayName(instructor: RosterInstructor) {
  const firstName = instructor.first_name?.trim() || instructor.user?.first_name?.trim() || ""
  const lastName = instructor.last_name?.trim() || instructor.user?.last_name?.trim() || ""
  const fullName = `${firstName} ${lastName}`.trim()

  return fullName || instructor.user?.email || "Instructor"
}

export async function fetchRosterPageData(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<RosterPageData> {
  const [instructorsResult, rosterRulesResult, settingsResult] = await Promise.all([
    supabase
      .from("instructors")
      .select(
        "id, first_name, last_name, user:user_directory!instructors_user_id_fkey(first_name, last_name, email)"
      )
      .eq("tenant_id", tenantId)
      .order("is_actively_instructing", { ascending: false })
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }),
    supabase
      .from("roster_rules")
      .select(
        "id, instructor_id, day_of_week, start_time, end_time, effective_from, effective_until, is_active, notes, voided_at, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("tenant_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ])

  if (instructorsResult.error) throw instructorsResult.error
  if (rosterRulesResult.error) throw rosterRulesResult.error

  const instructors = ((instructorsResult.data ?? []) as RosterInstructor[]).sort((a, b) =>
    getInstructorDisplayName(a).localeCompare(getInstructorDisplayName(b))
  )

  const rosterRules = (rosterRulesResult.data ?? []) as RosterRule[]
  const tenantSettings = (settingsResult.data?.settings ?? null) as Json | null

  return {
    instructors,
    rosterRules,
    timelineConfig: buildTimelineConfig(tenantSettings),
    tenantSettings,
  }
}
