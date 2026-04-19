import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { isStaffRole } from "@/lib/auth/roles"
import type { Database } from "@/lib/types"
import type { UserRole } from "@/lib/types/roles"
import type { DashboardAircraftStatus, DashboardBookingLite, DashboardData } from "@/lib/types/dashboard"
import { zonedDayRangeUtcIso, zonedTodayYyyyMmDd } from "@/lib/utils/timezone"

const DASHBOARD_BOOKING_SELECT = `
  id,
  start_time,
  end_time,
  status,
  booking_type,
  purpose,
  user_id,
  instructor_id,
  aircraft_id,
  student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email),
  instructor:instructors!bookings_instructor_id_fkey(
    id,
    first_name,
    last_name,
    user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)
  ),
  aircraft:aircraft!bookings_aircraft_id_fkey(id, registration, type, model, manufacturer)
` as const

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function monthKeyFromTodayKey(todayKey: string) {
  // todayKey: YYYY-MM-DD
  const [yearString, monthString] = todayKey.split("-")
  return { year: Number(yearString), month: Number(monthString) }
}

function startOfMonthKey(todayKey: string) {
  return `${todayKey.slice(0, 8)}01`
}

function nextMonthKey(todayKey: string) {
  const { year, month } = monthKeyFromTodayKey(todayKey)
  const next = new Date(Date.UTC(year, month, 1, 12, 0, 0))
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`
}

function monthLabelFromNow(now: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone }).format(now)
  } catch {
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(now)
  }
}

function safeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return 0
}

export async function fetchDashboardPageData(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  viewer?: { userId: string; role: UserRole | null }
): Promise<{ data: DashboardData; loadErrors: string[] }> {
  const memberScope = viewer && !isStaffRole(viewer.role)
  const viewerUserId = viewer?.userId
  const now = new Date()
  const nowIso = now.toISOString()

  const loadErrors: string[] = []
  let tenantName = "FlightDesk"
  let timeZone = "Pacific/Auckland"

  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("name, timezone")
      .eq("id", tenantId)
      .maybeSingle()
    if (error) throw error
    if (data?.name) tenantName = data.name
    if (data?.timezone) timeZone = data.timezone
  } catch {
    loadErrors.push("tenant details")
  }

  const todayKey = zonedTodayYyyyMmDd(timeZone)
  const { startUtcIso: todayStartUtcIso, endUtcIso: todayEndUtcIso } = zonedDayRangeUtcIso({
    dateYyyyMmDd: todayKey,
    timeZone,
  })

  const monthStartKey = startOfMonthKey(todayKey)
  const monthEndKey = nextMonthKey(todayKey)
  const { startUtcIso: monthStartUtcIso } = zonedDayRangeUtcIso({
    dateYyyyMmDd: monthStartKey,
    timeZone,
  })
  const { startUtcIso: monthEndUtcIso } = zonedDayRangeUtcIso({
    dateYyyyMmDd: monthEndKey,
    timeZone,
  })

  let bookingRequests: DashboardBookingLite[] = []
  let flyingNowBookings: DashboardBookingLite[] = []
  let upcomingBookings: DashboardBookingLite[] = []

  let memberCompliance: { medicalDue: string | null; bfrDue: string | null } | null = null

  let aircraftStatus: DashboardAircraftStatus[] = []

  let flightsThisMonth = 0
  let hoursFlownThisMonth = 0
  let activeStudentsThisMonth = 0

  const monthLabel = monthLabelFromNow(now, timeZone)
  const daysElapsedThisMonth = Math.max(1, Number(todayKey.split("-")[2] ?? 1))

  const bookingRequestsPromise = (async () => {
    try {
      let q = supabase
        .from("bookings")
        .select(DASHBOARD_BOOKING_SELECT)
        .eq("tenant_id", tenantId)
        .eq("status", "unconfirmed")
        .gte("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(10)
      if (memberScope && viewerUserId) q = q.eq("user_id", viewerUserId)
      const { data, error } = await q
      if (error) throw error
      bookingRequests = (data ?? []) as DashboardBookingLite[]
    } catch {
      loadErrors.push("booking requests")
    }
  })()

  const flyingNowPromise = (async () => {
    try {
      let q = supabase
        .from("bookings")
        .select(DASHBOARD_BOOKING_SELECT)
        .eq("tenant_id", tenantId)
        .eq("status", "flying")
        .order("start_time", { ascending: true })
        .limit(8)
      if (memberScope && viewerUserId) q = q.eq("user_id", viewerUserId)
      const { data, error } = await q
      if (error) throw error
      flyingNowBookings = (data ?? []) as DashboardBookingLite[]
    } catch {
      loadErrors.push("flying bookings")
    }
  })()

  const upcomingSchedulePromise = (async () => {
    try {
      if (memberScope && viewerUserId) {
        const { data, error } = await supabase
          .from("bookings")
          .select(DASHBOARD_BOOKING_SELECT)
          .eq("tenant_id", tenantId)
          .eq("user_id", viewerUserId)
          .gte("start_time", nowIso)
          .in("status", ["confirmed", "briefing", "flying"])
          .order("start_time", { ascending: true })
          .limit(25)
        if (error) throw error
        upcomingBookings = (data ?? []) as DashboardBookingLite[]
        return
      }

      const { data, error } = await supabase
        .from("bookings")
        .select(DASHBOARD_BOOKING_SELECT)
        .eq("tenant_id", tenantId)
        .gte("start_time", todayStartUtcIso)
        .lt("start_time", todayEndUtcIso)
        .gte("start_time", nowIso)
        .in("status", ["unconfirmed", "confirmed", "briefing"])
        .order("start_time", { ascending: true })
        .limit(10)
      if (error) throw error
      upcomingBookings = (data ?? []) as DashboardBookingLite[]
    } catch {
      loadErrors.push(memberScope ? "upcoming bookings" : "today's schedule")
    }
  })()

  const monthlyMetricsPromise = (async () => {
    try {
      let flightCountQ = supabase
        .from("bookings")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("booking_type", "flight")
        .neq("status", "cancelled")
        .gte("start_time", monthStartUtcIso)
        .lt("start_time", monthEndUtcIso)
        .limit(5000)
      let hoursQ = supabase
        .from("bookings")
        .select("billing_hours")
        .eq("tenant_id", tenantId)
        .eq("booking_type", "flight")
        .eq("status", "complete")
        .gte("start_time", monthStartUtcIso)
        .lt("start_time", monthEndUtcIso)
        .limit(5000)
      if (memberScope && viewerUserId) {
        flightCountQ = flightCountQ.eq("user_id", viewerUserId)
        hoursQ = hoursQ.eq("user_id", viewerUserId)
      }

      const [flightCountResult, hoursResult] = await Promise.all([flightCountQ, hoursQ])

      if (flightCountResult.error) throw flightCountResult.error
      if (hoursResult.error) throw hoursResult.error

      flightsThisMonth = (flightCountResult.data ?? []).length
      hoursFlownThisMonth = (hoursResult.data ?? []).reduce((sum, row) => sum + safeNumber(row.billing_hours), 0)

      if (memberScope) {
        activeStudentsThisMonth = 0
      } else {
        const activeStudentsQ = supabase
          .from("bookings")
          .select("user_id")
          .eq("tenant_id", tenantId)
          .eq("booking_type", "flight")
          .in("status", ["confirmed", "briefing", "flying", "complete"])
          .gte("start_time", monthStartUtcIso)
          .lt("start_time", monthEndUtcIso)
          .limit(5000)

        const activeStudentsResult = await activeStudentsQ
        if (activeStudentsResult.error) throw activeStudentsResult.error

        const studentIds = new Set<string>()
        for (const row of activeStudentsResult.data ?? []) {
          if (row.user_id) studentIds.add(row.user_id)
        }
        activeStudentsThisMonth = studentIds.size
      }
    } catch {
      loadErrors.push("monthly metrics")
    }
  })()

  const memberCompliancePromise = (async () => {
    if (!memberScope || !viewerUserId) return
    try {
      const { data, error } = await supabase
        .from("users")
        .select("medical_certificate_expiry, class_1_medical_due, class_2_medical_due, BFR_due")
        .eq("id", viewerUserId)
        .maybeSingle()
      if (error) throw error
      if (!data) {
        memberCompliance = { medicalDue: null, bfrDue: null }
        return
      }
      const medicalDue =
        data.medical_certificate_expiry ?? data.class_1_medical_due ?? data.class_2_medical_due ?? null
      memberCompliance = {
        medicalDue,
        bfrDue: data.BFR_due ?? null,
      }
    } catch {
      loadErrors.push("pilot compliance dates")
      memberCompliance = { medicalDue: null, bfrDue: null }
    }
  })()

  await Promise.all([
    bookingRequestsPromise,
    flyingNowPromise,
    upcomingSchedulePromise,
    monthlyMetricsPromise,
    memberCompliancePromise,
  ])

  if (memberScope) {
    const avgFlightsPerDayThisMonth = flightsThisMonth / daysElapsedThisMonth
    const data: DashboardData = {
      tenantName,
      timeZone,
      nowIso,
      viewerKind: "member",
      memberCompliance: memberCompliance ?? { medicalDue: null, bfrDue: null },
      metrics: {
        monthLabel,
        hoursFlownThisMonth,
        flightsThisMonth,
        activeStudentsThisMonth,
        avgFlightsPerDayThisMonth,
        upcomingToday: upcomingBookings.length,
        flyingNow: flyingNowBookings.length,
        bookingRequests: bookingRequests.length,
        fleetAttention: 0,
      },
      bookingRequests,
      flyingNowBookings,
      upcomingBookings,
      aircraftStatus: [],
    }
    return { data, loadErrors }
  }

  try {
    const { data: aircraftRows, error: aircraftError } = await supabase
      .from("aircraft")
      .select("id, registration, type, model, manufacturer, order")
      .eq("tenant_id", tenantId)
      .is("voided_at", null)
      .order("order", { ascending: true })
      .order("registration", { ascending: true })
      .limit(12)

    if (aircraftError) throw aircraftError

    const aircraft = (aircraftRows ?? []).filter((row) => row.registration)
    const aircraftIds = aircraft.map((row) => row.id)
    const flyingAircraftIds = new Set<string>(
      flyingNowBookings.map((b) => b.aircraft_id).filter(Boolean) as string[]
    )

    let openObsRows: { aircraft_id: string | null }[] = []
    if (aircraftIds.length) {
      const { data, error } = await supabase
        .from("observations")
        .select("aircraft_id")
        .eq("tenant_id", tenantId)
        .is("resolved_at", null)
        .in("aircraft_id", aircraftIds)
        .limit(2000)
      if (error) throw error
      openObsRows = data ?? []
    }

    const openObsCounts = new Map<string, number>()
    for (const row of openObsRows ?? []) {
      if (!row.aircraft_id) continue
      openObsCounts.set(row.aircraft_id, (openObsCounts.get(row.aircraft_id) ?? 0) + 1)
    }

    aircraftStatus = aircraft.map((row) => ({
      id: row.id,
      registration: row.registration ?? "—",
      type: row.type ?? null,
      model: row.model ?? null,
      manufacturer: row.manufacturer ?? null,
      openObservations: openObsCounts.get(row.id) ?? 0,
      isFlying: flyingAircraftIds.has(row.id),
    }))
  } catch {
    loadErrors.push("aircraft status")
  }

  const fleetAttention = aircraftStatus.filter((a) => a.openObservations > 0).length
  const avgFlightsPerDayThisMonth = flightsThisMonth / daysElapsedThisMonth

  const data: DashboardData = {
    tenantName,
    timeZone,
    nowIso,
    viewerKind: "staff",
    memberCompliance: null,
    metrics: {
      monthLabel,
      hoursFlownThisMonth,
      flightsThisMonth,
      activeStudentsThisMonth,
      avgFlightsPerDayThisMonth,
      upcomingToday: upcomingBookings.length,
      flyingNow: flyingNowBookings.length,
      bookingRequests: bookingRequests.length,
      fleetAttention,
    },
    bookingRequests,
    flyingNowBookings,
    upcomingBookings,
    aircraftStatus,
  }

  return { data, loadErrors }
}

