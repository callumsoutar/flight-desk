import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { BookingsFilter, BookingWithRelations } from "@/lib/types/bookings"

export async function fetchBookings(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  filters?: BookingsFilter
): Promise<BookingWithRelations[]> {
  let query = supabase
    .from("bookings")
    .select(
      "*, student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(id, registration, type, model, manufacturer), flight_type:flight_types!bookings_flight_type_id_fkey(id, name, instruction_type), lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id)"
    )
    .eq("tenant_id", tenantId)
    .order("start_time", { ascending: true })

  if (filters?.status?.length) {
    query = query.in("status", filters.status)
  }

  if (filters?.booking_type?.length) {
    query = query.in("booking_type", filters.booking_type)
  }

  if (filters?.aircraft_id) {
    query = query.eq("aircraft_id", filters.aircraft_id)
  }

  if (filters?.instructor_id) {
    query = query.eq("instructor_id", filters.instructor_id)
  }

  if (filters?.user_id) {
    query = query.eq("user_id", filters.user_id)
  }

  if (filters?.start_date) {
    query = query.gte("start_time", filters.start_date)
  }

  if (filters?.end_date) {
    query = query.lte("start_time", filters.end_date)
  }

  const { data, error } = await query
  if (error) throw error

  let bookings = (data ?? []) as BookingWithRelations[]

  const search = filters?.search?.trim().toLowerCase()
  if (!search) return bookings

  bookings = bookings.filter((booking) => {
    const aircraft = [
      booking.aircraft?.registration,
      booking.aircraft?.manufacturer,
      booking.aircraft?.type,
      booking.aircraft?.model,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    const student = [booking.student?.first_name, booking.student?.last_name, booking.student?.email]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    const instructor = [
      booking.instructor?.user?.first_name ?? booking.instructor?.first_name,
      booking.instructor?.user?.last_name ?? booking.instructor?.last_name,
      booking.instructor?.user?.email,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    const purpose = (booking.purpose ?? "").toLowerCase()

    return (
      aircraft.includes(search) ||
      student.includes(search) ||
      instructor.includes(search) ||
      purpose.includes(search)
    )
  })

  return bookings
}
