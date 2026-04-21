import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { isStaffRole } from "@/lib/auth/roles"
import { fetchBookingsSettings } from "@/lib/settings/fetch-bookings-settings"
import type { Database } from "@/lib/types"
import type { UserRole } from "@/lib/types/roles"
import type { AuditLog, AuditLookupMaps, BookingOptions, BookingWithRelations } from "@/lib/types/bookings"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export type BookingPageData = {
  booking: BookingWithRelations | null
  options: BookingOptions
  auditLogs: AuditLog[]
  auditLookupMaps: AuditLookupMaps
}

async function fetchBooking(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  bookingId: string
): Promise<BookingWithRelations | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "*, student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), checked_out_instructor:instructors!bookings_checked_out_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(id, registration, type, model, manufacturer, current_hobbs, current_tach, fuel_consumption, aircraft_type_id), checked_out_aircraft:aircraft!bookings_checked_out_aircraft_id_fkey(id, registration, type, model, manufacturer, current_hobbs, current_tach, fuel_consumption, aircraft_type_id), flight_type:flight_types!bookings_flight_type_id_fkey(id, name, instruction_type, billing_mode, aircraft_gl_code, duration_minutes, fixed_package_price), lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id), lesson_progress(*)"
    )
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as BookingWithRelations | null
}

function emptyBookingOptionsPartial(): BookingOptions {
  return {
    aircraft: [],
    aircraftTypes: [],
    members: [],
    instructors: [],
    flightTypes: [],
    syllabi: [],
    lessons: [],
    chargeables: [],
    chargeableTypes: [],
    landingFeeRates: [],
  }
}

async function fetchOptions(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  viewerUserId: string,
  role: UserRole | null
): Promise<BookingOptions> {
  const membersPromise = isStaffRole(role)
    ? supabase
        .from("tenant_users")
        .select("user:user_directory!tenant_users_user_id_fkey(id, first_name, last_name, email)")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
    : supabase
        .from("user_directory")
        .select("id, first_name, last_name, email")
        .eq("id", viewerUserId)
        .maybeSingle()

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
    bookingsSettings,
  ] = await Promise.all([
      supabase
        .from("aircraft")
        .select("id, registration, type, model, manufacturer, aircraft_type_id, fuel_consumption")
        .eq("tenant_id", tenantId)
        .is("voided_at", null)
        .order("registration", { ascending: true }),
      supabase
        .from("aircraft_types")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true }),
      membersPromise,
      supabase
        .from("instructors")
        .select("id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)")
        .eq("tenant_id", tenantId)
        .is("voided_at", null)
        .eq("is_actively_instructing", true)
        .order("first_name", { ascending: true }),
      supabase
        .from("flight_types")
        .select("id, name, instruction_type, billing_mode, aircraft_gl_code, duration_minutes, fixed_package_price")
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
        .select("id, code, name, description, scope, system_key, is_active")
        .eq("is_active", true)
        .or(`tenant_id.eq.${tenantId},scope.eq.system`)
        .order("name", { ascending: true }),
      supabase
        .from("landing_fee_rates")
        .select("id, chargeable_id, aircraft_type_id, rate")
        .eq("tenant_id", tenantId),
      fetchBookingsSettings(supabase, tenantId),
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

  let members: BookingOptions["members"] = []

  if (isStaffRole(role)) {
    const rows = (membersResult.data ?? []) as Array<{
      user:
        | { id: string; first_name: string | null; last_name: string | null; email: string }
        | Array<{ id: string; first_name: string | null; last_name: string | null; email: string }>
        | null
    }>
    members = rows
      .map((row) => pickMaybeOne(row.user))
      .filter(
        (user): user is BookingOptions["members"][number] =>
          Boolean(user && typeof user.id === "string" && user.id && typeof user.email === "string")
      )
  } else {
    const me = membersResult.data as {
      id: string
      first_name: string | null
      last_name: string | null
      email: string
    } | null
    if (me?.id && me.email) {
      members = [me]
    }
  }

  return {
    aircraft: (aircraftResult.data ?? []) as BookingOptions["aircraft"],
    aircraftTypes: (aircraftTypesResult.data ?? []) as NonNullable<BookingOptions["aircraftTypes"]>,
    members,
    instructors: (instructorsResult.data ?? []) as BookingOptions["instructors"],
    flightTypes: (flightTypesResult.data ?? []) as BookingOptions["flightTypes"],
    syllabi: (syllabiResult.data ?? []) as BookingOptions["syllabi"],
    lessons: (lessonsResult.data ?? []) as BookingOptions["lessons"],
    chargeables: (chargeablesResult.data ?? []) as NonNullable<BookingOptions["chargeables"]>,
    bookingsSettings,
    chargeableTypes: (chargeableTypesResult.data ?? []) as NonNullable<BookingOptions["chargeableTypes"]>,
    landingFeeRates: (landingFeeRatesResult.data ?? []) as NonNullable<BookingOptions["landingFeeRates"]>,
  }
}

async function fetchAuditLogs(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  bookingId: string
): Promise<{ logs: AuditLog[]; maps: AuditLookupMaps }> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("table_name", "bookings")
    .eq("record_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) throw error

  const rawLogs = data ?? []

  // Collect all unique IDs needed for lookups
  const changeAuthorIds = new Set<string>()
  const memberIds = new Set<string>()
  const instructorIds = new Set<string>()
  const lessonIds = new Set<string>()
  const flightTypeIds = new Set<string>()
  const aircraftIds = new Set<string>()

  for (const log of rawLogs) {
    if (log.user_id) changeAuthorIds.add(log.user_id)
    for (const dataObj of [log.new_data, log.old_data]) {
      if (!dataObj || typeof dataObj !== "object" || Array.isArray(dataObj)) continue
      const record = dataObj as Record<string, unknown>
      if (typeof record.user_id === "string") memberIds.add(record.user_id)
      if (typeof record.instructor_id === "string") instructorIds.add(record.instructor_id)
      if (typeof record.lesson_id === "string") lessonIds.add(record.lesson_id)
      if (typeof record.flight_type_id === "string") flightTypeIds.add(record.flight_type_id)
      if (typeof record.aircraft_id === "string") aircraftIds.add(record.aircraft_id)
    }
  }

  // Merge all user IDs (change authors + booking members)
  const allUserIds = new Set([...changeAuthorIds, ...memberIds])

  type UserRow = { id: string; first_name: string | null; last_name: string | null; email: string }
  type InstructorRow = { id: string; first_name: string | null; last_name: string | null }
  type NameRow = { id: string; name: string }
  type AircraftRow = { id: string; registration: string }

  const empty = <T,>(): Promise<{ data: T[]; error: null }> =>
    Promise.resolve({ data: [] as T[], error: null })

  const [usersResult, instructorsResult, lessonsResult, flightTypesResult, aircraftResult] =
    await Promise.all([
      allUserIds.size > 0
        ? supabase.from("user_directory").select("id, first_name, last_name, email").in("id", Array.from(allUserIds))
        : empty<UserRow>(),
      instructorIds.size > 0
        ? supabase.from("instructors").select("id, first_name, last_name").in("id", Array.from(instructorIds))
        : empty<InstructorRow>(),
      lessonIds.size > 0
        ? supabase.from("lessons").select("id, name").in("id", Array.from(lessonIds))
        : empty<NameRow>(),
      flightTypeIds.size > 0
        ? supabase.from("flight_types").select("id, name").in("id", Array.from(flightTypeIds))
        : empty<NameRow>(),
      aircraftIds.size > 0
        ? supabase.from("aircraft").select("id, registration").in("id", Array.from(aircraftIds))
        : empty<AircraftRow>(),
    ])

  // Build lookup maps
  const userMap = new Map<string, UserRow>()
  for (const u of usersResult.data ?? []) {
    if (typeof u.id === "string" && typeof u.email === "string") {
      userMap.set(u.id, u as UserRow)
    }
  }

  const formatName = (first: string | null, last: string | null, fallback: string): string =>
    [first, last].filter(Boolean).join(" ") || fallback

  const usersLookup: Record<string, string> = {}
  for (const u of usersResult.data ?? []) {
    if (typeof u.id === "string") {
      usersLookup[u.id] = formatName(u.first_name, u.last_name, u.email as string)
    }
  }

  const instructorsLookup: Record<string, string> = {}
  for (const i of instructorsResult.data ?? []) {
    if (typeof i.id === "string") {
      instructorsLookup[i.id] = formatName((i as InstructorRow).first_name, (i as InstructorRow).last_name, "Unknown")
    }
  }

  const lessonsLookup: Record<string, string> = {}
  for (const l of lessonsResult.data ?? []) {
    if (typeof l.id === "string") lessonsLookup[l.id] = (l as NameRow).name
  }

  const flightTypesLookup: Record<string, string> = {}
  for (const ft of flightTypesResult.data ?? []) {
    if (typeof ft.id === "string") flightTypesLookup[ft.id] = (ft as NameRow).name
  }

  const aircraftLookup: Record<string, string> = {}
  for (const a of aircraftResult.data ?? []) {
    if (typeof a.id === "string") aircraftLookup[a.id] = (a as AircraftRow).registration
  }

  const logs: AuditLog[] = rawLogs.map((row) => ({
    ...row,
    user: row.user_id ? (userMap.get(row.user_id) ?? null) : null,
  }))

  const maps: AuditLookupMaps = {
    users: usersLookup,
    instructors: instructorsLookup,
    lessons: lessonsLookup,
    flightTypes: flightTypesLookup,
    aircraft: aircraftLookup,
  }

  return { logs, maps }
}

export async function fetchBookingPageData(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  bookingId: string,
  access: { userId: string; role: UserRole | null }
): Promise<BookingPageData> {
  const booking = await fetchBooking(supabase, tenantId, bookingId)

  if (!booking) {
    return {
      booking: null,
      options: emptyBookingOptionsPartial(),
      auditLogs: [],
      auditLookupMaps: {
        users: {},
        instructors: {},
        lessons: {},
        flightTypes: {},
        aircraft: {},
      },
    }
  }

  if (!isStaffRole(access.role) && booking.user_id !== access.userId) {
    return {
      booking: null,
      options: emptyBookingOptionsPartial(),
      auditLogs: [],
      auditLookupMaps: {
        users: {},
        instructors: {},
        lessons: {},
        flightTypes: {},
        aircraft: {},
      },
    }
  }

  const [options, auditResult] = await Promise.all([
    fetchOptions(supabase, tenantId, access.userId, access.role),
    fetchAuditLogs(supabase, tenantId, bookingId),
  ])

  return { booking, options, auditLogs: auditResult.logs, auditLookupMaps: auditResult.maps }
}
