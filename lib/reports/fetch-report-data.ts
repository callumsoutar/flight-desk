import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"

export type MonthlyBookingVolume = {
  month: string
  label: string
  flight: number
  groundwork: number
  maintenance: number
  other: number
  total: number
}

export type MonthlyCancellationRate = {
  month: string
  label: string
  total: number
  cancelled: number
  rate: number
}

export type CancellationReason = {
  name: string
  count: number
}

export type InstructorUtilisation = {
  name: string
  hours: number
  bookings: number
}

export type AircraftHours = {
  registration: string
  type: string
  hours: number
  bookings: number
}

export type MonthlyTrainingActivity = {
  month: string
  label: string
  sessions: number
  pass: number
  notYetCompetent: number
}

export type SyllabusProgressItem = {
  name: string
  enrolled: number
  completed: number
  inProgress: number
}

export type MonthlyObservations = {
  month: string
  label: string
  count: number
}

export type ObservationsByStage = {
  stage: string
  count: number
  fill: string
}

export type ReportSummary = {
  totalBookings: number
  completedBookings: number
  cancelledBookings: number
  cancellationRate: number
  totalFlightHours: number
  activeAircraft: number
  activeStudents: number
  openObservations: number
}

export type ReportData = {
  bookingVolume: MonthlyBookingVolume[]
  cancellationRate: MonthlyCancellationRate[]
  cancellationReasons: CancellationReason[]
  instructorUtilisation: InstructorUtilisation[]
  aircraftHours: AircraftHours[]
  trainingActivity: MonthlyTrainingActivity[]
  syllabusProgress: SyllabusProgressItem[]
  observationTrends: MonthlyObservations[]
  observationsByStage: ObservationsByStage[]
  summary: ReportSummary
}

export type DateRangePreset =
  | "last30d"
  | "last3m"
  | "last6m"
  | "last12m"
  | "thisMonth"
  | "thisYear"
  | "custom"

export type DateRange = {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  preset: DateRangePreset
}

export function resolveDateRange(
  preset: DateRangePreset,
  customFrom?: string | null,
  customTo?: string | null
): DateRange {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  switch (preset) {
    case "last30d": {
      const from = new Date(now)
      from.setDate(from.getDate() - 29)
      return { startDate: from.toISOString().slice(0, 10), endDate: today, preset }
    }
    case "last3m": {
      const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return { startDate: from.toISOString().slice(0, 10), endDate: today, preset }
    }
    case "last6m": {
      const from = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      return { startDate: from.toISOString().slice(0, 10), endDate: today, preset }
    }
    case "last12m": {
      const from = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      return { startDate: from.toISOString().slice(0, 10), endDate: today, preset }
    }
    case "thisMonth": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return { startDate: from.toISOString().slice(0, 10), endDate: today, preset }
    }
    case "thisYear": {
      return { startDate: `${now.getFullYear()}-01-01`, endDate: today, preset }
    }
    case "custom": {
      const from = customFrom ?? new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10)
      const to = customTo ?? today
      return { startDate: from, endDate: to, preset }
    }
  }
}

function getShortMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-")
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString("en-NZ", { month: "short", year: "2-digit" })
}

function toYearMonth(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function getMonthsBetween(startDate: string, endDate: string): string[] {
  const months: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cur <= last) {
    months.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`
    )
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

const STAGE_COLORS: Record<string, string> = {
  open: "hsl(217, 91%, 60%)",
  investigation: "hsl(235, 55%, 58%)",
  resolution: "hsl(199, 89%, 48%)",
  closed: "hsl(220, 14%, 75%)",
}

export async function fetchReportData(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  dateRange: DateRange
): Promise<ReportData> {
  const { startDate, endDate } = dateRange
  const months = getMonthsBetween(startDate, endDate)

  const [
    bookingsResult,
    aircraftResult,
    instructorsResult,
    lessonProgressResult,
    enrollmentsResult,
    syllabiResult,
    observationsResult,
    cancellationCategoriesResult,
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, start_time, end_time, status, booking_type, instructor_id, aircraft_id, cancellation_category_id, billing_hours, flight_time_hobbs"
      )
      .eq("tenant_id", tenantId)
      .gte("start_time", startDate)
      .lte("start_time", endDate + "T23:59:59"),

    supabase
      .from("aircraft")
      .select("id, registration, type, on_line")
      .eq("tenant_id", tenantId),

    supabase
      .from("instructors")
      .select("id, first_name, last_name")
      .eq("tenant_id", tenantId)
      .eq("status", "active"),

    supabase
      .from("lesson_progress")
      .select("id, date, status, syllabus_id, user_id")
      .eq("tenant_id", tenantId)
      .gte("date", startDate)
      .lte("date", endDate),

    supabase
      .from("student_syllabus_enrollment")
      .select("id, syllabus_id, status")
      .eq("tenant_id", tenantId),

    supabase
      .from("syllabus")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true),

    supabase
      .from("observations")
      .select("id, reported_date, stage")
      .eq("tenant_id", tenantId),

    supabase
      .from("cancellation_categories")
      .select("id, name")
      .or(`tenant_id.eq.${tenantId},is_global.eq.true`),
  ])

  const bookings = bookingsResult.data ?? []
  const aircraft = aircraftResult.data ?? []
  const instructors = instructorsResult.data ?? []
  const lessonProgress = lessonProgressResult.data ?? []
  const enrollments = enrollmentsResult.data ?? []
  const syllabi = syllabiResult.data ?? []
  const observations = observationsResult.data ?? []
  const cancellationCategories = cancellationCategoriesResult.data ?? []

  // --- Booking Volume ---
  const volumeMap = new Map<
    string,
    { flight: number; groundwork: number; maintenance: number; other: number; total: number }
  >()
  for (const m of months) {
    volumeMap.set(m, { flight: 0, groundwork: 0, maintenance: 0, other: 0, total: 0 })
  }
  for (const b of bookings) {
    const ym = toYearMonth(b.start_time)
    const entry = volumeMap.get(ym)
    if (!entry) continue
    entry.total++
    const bt = b.booking_type as string
    if (bt === "flight") entry.flight++
    else if (bt === "groundwork") entry.groundwork++
    else if (bt === "maintenance") entry.maintenance++
    else entry.other++
  }
  const bookingVolume: MonthlyBookingVolume[] = months.map((m) => ({
    month: m,
    label: getShortMonthLabel(m),
    ...volumeMap.get(m)!,
  }))

  // --- Cancellation Rate ---
  const cancelledByMonth = new Map<string, number>()
  const totalByMonth = new Map<string, number>()
  for (const m of months) {
    cancelledByMonth.set(m, 0)
    totalByMonth.set(m, 0)
  }
  for (const b of bookings) {
    const ym = toYearMonth(b.start_time)
    if (!totalByMonth.has(ym)) continue
    totalByMonth.set(ym, (totalByMonth.get(ym) ?? 0) + 1)
    if (b.status === "cancelled") {
      cancelledByMonth.set(ym, (cancelledByMonth.get(ym) ?? 0) + 1)
    }
  }
  const cancellationRate: MonthlyCancellationRate[] = months.map((m) => {
    const total = totalByMonth.get(m) ?? 0
    const cancelled = cancelledByMonth.get(m) ?? 0
    return {
      month: m,
      label: getShortMonthLabel(m),
      total,
      cancelled,
      rate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    }
  })

  // --- Cancellation Reasons ---
  const categoryMap = new Map(cancellationCategories.map((c) => [c.id, c.name]))
  const reasonCounts = new Map<string, number>()
  for (const b of bookings) {
    if (b.status === "cancelled" && b.cancellation_category_id) {
      const name = categoryMap.get(b.cancellation_category_id) ?? "Other"
      reasonCounts.set(name, (reasonCounts.get(name) ?? 0) + 1)
    }
  }
  const cancellationReasons: CancellationReason[] = Array.from(
    reasonCounts.entries()
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // --- Instructor Utilisation ---
  const instrHoursMap = new Map<string, { hours: number; bookings: number }>()
  for (const b of bookings) {
    if (b.status !== "complete" || !b.instructor_id) continue
    const entry = instrHoursMap.get(b.instructor_id) ?? { hours: 0, bookings: 0 }
    entry.hours += b.billing_hours ?? b.flight_time_hobbs ?? 0
    entry.bookings++
    instrHoursMap.set(b.instructor_id, entry)
  }
  const instrNameMap = new Map(
    instructors.map((i) => [
      i.id,
      `${i.first_name ?? ""} ${i.last_name ?? ""}`.trim() || "Unknown",
    ])
  )
  const instructorUtilisation: InstructorUtilisation[] = Array.from(
    instrHoursMap.entries()
  )
    .map(([id, d]) => ({
      name: instrNameMap.get(id) ?? "Unknown",
      hours: Math.round(d.hours * 10) / 10,
      bookings: d.bookings,
    }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10)

  // --- Aircraft Hours ---
  const acftHoursMap = new Map<string, { hours: number; bookings: number }>()
  for (const b of bookings) {
    if (b.status !== "complete" || !b.aircraft_id) continue
    const entry = acftHoursMap.get(b.aircraft_id) ?? { hours: 0, bookings: 0 }
    entry.hours += b.billing_hours ?? b.flight_time_hobbs ?? 0
    entry.bookings++
    acftHoursMap.set(b.aircraft_id, entry)
  }
  const aircraftHoursData: AircraftHours[] = aircraft
    .map((a) => {
      const d = acftHoursMap.get(a.id) ?? { hours: 0, bookings: 0 }
      return {
        registration: a.registration,
        type: a.type,
        hours: Math.round(d.hours * 10) / 10,
        bookings: d.bookings,
      }
    })
    .sort((a, b) => b.hours - a.hours)

  // --- Training Activity ---
  const trainingMap = new Map<
    string,
    { sessions: number; pass: number; notYetCompetent: number }
  >()
  for (const m of months) {
    trainingMap.set(m, { sessions: 0, pass: 0, notYetCompetent: 0 })
  }
  for (const lp of lessonProgress) {
    const ym = toYearMonth(lp.date)
    const entry = trainingMap.get(ym)
    if (!entry) continue
    entry.sessions++
    if (lp.status === "pass") entry.pass++
    else entry.notYetCompetent++
  }
  const trainingActivity: MonthlyTrainingActivity[] = months.map((m) => ({
    month: m,
    label: getShortMonthLabel(m),
    ...trainingMap.get(m)!,
  }))

  // --- Syllabus Progress ---
  const syllabiNameMap = new Map(syllabi.map((s) => [s.id, s.name]))
  const syllProgMap = new Map<
    string,
    { name: string; enrolled: number; completed: number; inProgress: number }
  >()
  for (const e of enrollments) {
    const name = syllabiNameMap.get(e.syllabus_id)
    if (!name) continue
    const entry = syllProgMap.get(e.syllabus_id) ?? {
      name,
      enrolled: 0,
      completed: 0,
      inProgress: 0,
    }
    entry.enrolled++
    if (e.status === "completed") entry.completed++
    else entry.inProgress++
    syllProgMap.set(e.syllabus_id, entry)
  }
  const syllabusProgress: SyllabusProgressItem[] = Array.from(
    syllProgMap.values()
  ).sort((a, b) => b.enrolled - a.enrolled)

  // --- Observation Trends (last 12 months only) ---
  const obsByMonth = new Map<string, number>()
  for (const m of months) obsByMonth.set(m, 0)
  for (const o of observations) {
    const ym = toYearMonth(o.reported_date)
    if (obsByMonth.has(ym)) {
      obsByMonth.set(ym, (obsByMonth.get(ym) ?? 0) + 1)
    }
  }
  const observationTrends: MonthlyObservations[] = months.map((m) => ({
    month: m,
    label: getShortMonthLabel(m),
    count: obsByMonth.get(m) ?? 0,
  }))

  // --- Observations by Stage (all time) ---
  const stageCounts = new Map<string, number>()
  for (const o of observations) {
    const stage = o.stage as string
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1)
  }
  const observationsByStage: ObservationsByStage[] = Array.from(
    stageCounts.entries()
  )
    .map(([stage, count]) => ({
      stage,
      count,
      fill: STAGE_COLORS[stage] ?? "hsl(var(--chart-5))",
    }))
    .sort((a, b) => b.count - a.count)

  // --- Summary ---
  const totalBookings = bookings.length
  const completedBookings = bookings.filter((b) => b.status === "complete").length
  const cancelledBookings = bookings.filter((b) => b.status === "cancelled").length
  const totalFlightHours = bookings
    .filter((b) => b.status === "complete")
    .reduce((sum, b) => sum + (b.billing_hours ?? b.flight_time_hobbs ?? 0), 0)
  const activeAircraft = aircraft.filter((a) => a.on_line).length
  const activeStudents = new Set(lessonProgress.map((lp) => lp.user_id)).size
  const openObservations = observations.filter(
    (o) => (o.stage as string) !== "closed"
  ).length

  return {
    bookingVolume,
    cancellationRate,
    cancellationReasons,
    instructorUtilisation,
    aircraftHours: aircraftHoursData,
    trainingActivity,
    syllabusProgress,
    observationTrends,
    observationsByStage,
    summary: {
      totalBookings,
      completedBookings,
      cancelledBookings,
      cancellationRate:
        totalBookings > 0
          ? Math.round((cancelledBookings / totalBookings) * 100)
          : 0,
      totalFlightHours: Math.round(totalFlightHours * 10) / 10,
      activeAircraft,
      activeStudents,
      openObservations,
    },
  }
}
