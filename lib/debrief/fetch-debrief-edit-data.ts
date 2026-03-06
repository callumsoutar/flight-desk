import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type { LessonProgressWithInstructor } from "@/lib/types/debrief"

const BOOKING_SELECT =
  "*, student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), checked_out_instructor:instructors!bookings_checked_out_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(id, registration, type, model, manufacturer, current_hobbs, current_tach, fuel_consumption, aircraft_type_id), checked_out_aircraft:aircraft!bookings_checked_out_aircraft_id_fkey(id, registration, type, model, manufacturer, current_hobbs, current_tach, fuel_consumption, aircraft_type_id), flight_type:flight_types!bookings_flight_type_id_fkey(id, name, instruction_type), lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id)"

export type DebriefEditPageData = {
  booking: BookingWithRelations | null
  lessonProgress: LessonProgressWithInstructor | null
}

export async function fetchDebriefEditData(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  bookingId: string
): Promise<DebriefEditPageData> {
  const [bookingResult, lessonProgressResult] = await Promise.all([
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
  ])

  if (bookingResult.error) throw bookingResult.error
  if (lessonProgressResult.error) throw lessonProgressResult.error

  const booking = bookingResult.data ? (bookingResult.data as BookingWithRelations) : null
  const lessonProgress = lessonProgressResult.data as LessonProgressWithInstructor | null

  return {
    booking,
    lessonProgress,
  }
}
