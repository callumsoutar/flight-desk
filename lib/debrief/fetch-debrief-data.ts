import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type {
  DebriefPageData,
  FlightExperienceEntryWithType,
  LessonProgressWithInstructor,
} from "@/lib/types/debrief"

const BOOKING_SELECT =
  "*, student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), checked_out_instructor:instructors!bookings_checked_out_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(id, registration, type, model, manufacturer, current_hobbs, current_tach, fuel_consumption, aircraft_type_id), checked_out_aircraft:aircraft!bookings_checked_out_aircraft_id_fkey(id, registration, type, model, manufacturer, current_hobbs, current_tach, fuel_consumption, aircraft_type_id), flight_type:flight_types!bookings_flight_type_id_fkey(id, name, instruction_type), lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id)"

export async function fetchDebriefData(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  bookingId: string
): Promise<DebriefPageData> {
  const [bookingResult, lessonProgressResult, flightExperienceResult, experienceTypesResult] =
    await Promise.all([
      supabase
        .from("bookings")
        .select(BOOKING_SELECT)
        .eq("tenant_id", tenantId)
        .eq("id", bookingId)
        .maybeSingle(),
      supabase
        .from("lesson_progress")
        .select(
          "*, instructor:instructors!lesson_progress_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email))"
        )
        .eq("tenant_id", tenantId)
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("flight_experience")
        .select(
          "id, occurred_at, value, unit, notes, conditions, experience_type:experience_types!flight_experience_experience_type_id_fkey(id, name)"
        )
        .eq("tenant_id", tenantId)
        .eq("booking_id", bookingId)
        .order("occurred_at", { ascending: true }),
      supabase
        .from("experience_types")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .is("voided_at", null)
        .order("name", { ascending: true }),
    ])

  if (bookingResult.error) throw bookingResult.error
  if (lessonProgressResult.error) throw lessonProgressResult.error
  if (flightExperienceResult.error) throw flightExperienceResult.error
  if (experienceTypesResult.error) throw experienceTypesResult.error

  const rawBooking = bookingResult.data
  const lessonProgress = lessonProgressResult.data as LessonProgressWithInstructor | null
  const flightExperiences = (flightExperienceResult.data ?? []) as FlightExperienceEntryWithType[]
  const experienceTypes = (experienceTypesResult.data ?? []) as DebriefPageData["experienceTypes"]

  const booking = rawBooking
    ? ({ ...rawBooking, lesson_progress: null } as DebriefPageData["booking"])
    : null

  return {
    booking,
    lessonProgress,
    flightExperiences,
    experienceTypes,
  }
}
