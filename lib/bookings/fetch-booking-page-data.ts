import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { AuditLog, BookingOptions, BookingWithRelations } from "@/lib/types/bookings"

export type BookingPageData = {
  booking: BookingWithRelations | null
  options: BookingOptions
  auditLogs: AuditLog[]
}

async function fetchBooking(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  bookingId: string
): Promise<BookingWithRelations | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "*, student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), checked_out_instructor:instructors!bookings_checked_out_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(id, registration, type, model, manufacturer, current_hobbs, current_tach, aircraft_type_id), checked_out_aircraft:aircraft!bookings_checked_out_aircraft_id_fkey(id, registration, type, model, manufacturer, current_hobbs, current_tach, aircraft_type_id), flight_type:flight_types!bookings_flight_type_id_fkey(id, name, instruction_type), lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id), lesson_progress(*)"
    )
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as BookingWithRelations | null
}

async function fetchOptions(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<BookingOptions> {
  const [
    aircraftResult,
    aircraftTypesResult,
    membersResult,
    instructorsResult,
    flightTypesResult,
    syllabiResult,
    lessonsResult,
    chargeablesResult,
    chargeableTypesResult,
    landingFeeRatesResult,
  ] = await Promise.all([
      supabase
        .from("aircraft")
        .select("id, registration, type, model, manufacturer, aircraft_type_id")
        .eq("tenant_id", tenantId)
        .order("registration", { ascending: true }),
      supabase
        .from("aircraft_types")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true }),
      supabase
        .from("tenant_users")
        .select("user:user_directory!tenant_users_user_id_fkey(id, first_name, last_name, email)")
        .eq("tenant_id", tenantId)
        .eq("is_active", true),
      supabase
        .from("instructors")
        .select("id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)")
        .eq("tenant_id", tenantId)
        .eq("is_actively_instructing", true)
        .order("first_name", { ascending: true }),
      supabase
        .from("flight_types")
        .select("id, name, instruction_type")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .is("voided_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("syllabus")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .is("voided_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("lessons")
        .select("id, name, description, order, syllabus_id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("order", { ascending: true }),
      supabase
        .from("chargeables")
        .select("id, name, description, rate, is_taxable, chargeable_type_id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .is("voided_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("chargeable_types")
        .select("id, code, name, description, is_global, is_active")
        .eq("is_active", true)
        .or(`tenant_id.eq.${tenantId},is_global.eq.true`)
        .order("name", { ascending: true }),
      supabase
        .from("landing_fee_rates")
        .select("id, chargeable_id, aircraft_type_id, rate")
        .eq("tenant_id", tenantId),
    ])

  if (aircraftResult.error) throw aircraftResult.error
  if (aircraftTypesResult.error) throw aircraftTypesResult.error
  if (membersResult.error) throw membersResult.error
  if (instructorsResult.error) throw instructorsResult.error
  if (flightTypesResult.error) throw flightTypesResult.error
  if (syllabiResult.error) throw syllabiResult.error
  if (lessonsResult.error) throw lessonsResult.error
  if (chargeablesResult.error) throw chargeablesResult.error
  if (chargeableTypesResult.error) throw chargeableTypesResult.error
  if (landingFeeRatesResult.error) throw landingFeeRatesResult.error

  const members = (membersResult.data ?? [])
    .map((row) => row.user)
    .filter(
      (user): user is BookingOptions["members"][number] =>
        Boolean(user && typeof user.id === "string" && user.id && typeof user.email === "string")
    )

  return {
    aircraft: (aircraftResult.data ?? []) as BookingOptions["aircraft"],
    aircraftTypes: (aircraftTypesResult.data ?? []) as NonNullable<BookingOptions["aircraftTypes"]>,
    members,
    instructors: (instructorsResult.data ?? []) as BookingOptions["instructors"],
    flightTypes: (flightTypesResult.data ?? []) as BookingOptions["flightTypes"],
    syllabi: (syllabiResult.data ?? []) as BookingOptions["syllabi"],
    lessons: (lessonsResult.data ?? []) as BookingOptions["lessons"],
    chargeables: (chargeablesResult.data ?? []) as NonNullable<BookingOptions["chargeables"]>,
    chargeableTypes: (chargeableTypesResult.data ?? []) as NonNullable<BookingOptions["chargeableTypes"]>,
    landingFeeRates: (landingFeeRatesResult.data ?? []) as NonNullable<BookingOptions["landingFeeRates"]>,
  }
}

async function fetchAuditLogs(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  bookingId: string
): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("table_name", "bookings")
    .eq("record_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) throw error

  const logs = data ?? []
  const userIds = logs
    .map((row) => row.user_id)
    .filter((id): id is string => typeof id === "string")

  if (userIds.length === 0) {
    return logs.map((row) => ({ ...row, user: null }))
  }

  const { data: users, error: usersError } = await supabase
    .from("user_directory")
    .select("id, first_name, last_name, email")
    .in("id", Array.from(new Set(userIds)))

  if (usersError) throw usersError

  type AuditLogUser = NonNullable<AuditLog["user"]>
  const normalizedUsers = (users ?? []).filter(
    (row): row is AuditLogUser =>
      typeof row.id === "string" &&
      typeof row.email === "string"
  )
  const userMap = new Map(normalizedUsers.map((row) => [row.id, row]))

  return logs.map((row) => ({
    ...row,
    user: row.user_id ? userMap.get(row.user_id) ?? null : null,
  }))
}

export async function fetchBookingPageData(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  bookingId: string
): Promise<BookingPageData> {
  const [booking, options, auditLogs] = await Promise.all([
    fetchBooking(supabase, tenantId, bookingId),
    fetchOptions(supabase, tenantId),
    fetchAuditLogs(supabase, tenantId, bookingId),
  ])

  return { booking, options, auditLogs }
}
