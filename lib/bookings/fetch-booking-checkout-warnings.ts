import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { BookingWarningsResponse, BookingWarningCategory, BookingWarningItem, BookingWarningSeverity } from "@/lib/types/booking-warnings"

type CheckoutWarningOverrides = {
  bookingId: string
  userId?: string | null
  instructorId?: string | null
  aircraftId?: string | null
}

type GroupAccumulator = Record<BookingWarningCategory, BookingWarningItem[]>

const GROUP_CONFIG: Record<
  BookingWarningCategory,
  { title: string; description: string }
> = {
  pilot: {
    title: "Pilot / Member",
    description: "Pilot documents, flight review, and member account standing.",
  },
  instructor: {
    title: "Instructor",
    description: "Assigned instructor qualifications and instructor availability.",
  },
  aircraft: {
    title: "Aircraft",
    description: "Aircraft defects, maintenance items, and operational availability.",
  },
}

const SEVERITY_ORDER: Record<BookingWarningSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function isWarningItem(value: BookingWarningItem | null): value is BookingWarningItem {
  return value !== null
}

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function createEmptyGroups(): GroupAccumulator {
  return {
    pilot: [],
    instructor: [],
    aircraft: [],
  }
}

function formatPersonName(value: {
  first_name: string | null
  last_name: string | null
  email?: string | null
}) {
  return [value.first_name, value.last_name].filter(Boolean).join(" ").trim() || value.email || "Unknown"
}

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function diffCalendarDays(targetIso: string, now = new Date()) {
  const target = new Date(targetIso)
  if (Number.isNaN(target.getTime())) return null
  const diffMs = startOfDay(target).getTime() - startOfDay(now).getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

function getDateSeverity(daysRemaining: number): BookingWarningSeverity | null {
  if (daysRemaining < 0) return "critical"
  if (daysRemaining <= 1) return "high"
  if (daysRemaining <= 7) return "medium"
  if (daysRemaining <= 30) return "low"
  return null
}

function getHoursSeverity(hoursRemaining: number): BookingWarningSeverity | null {
  if (hoursRemaining < 0) return "critical"
  if (hoursRemaining <= 1) return "high"
  if (hoursRemaining <= 5) return "medium"
  if (hoursRemaining <= 10) return "low"
  return null
}

function getMostUrgentSeverity(
  left: BookingWarningSeverity | null,
  right: BookingWarningSeverity | null
) {
  if (!left) return right
  if (!right) return left
  return SEVERITY_ORDER[left] <= SEVERITY_ORDER[right] ? left : right
}

function getCountdownLabel(params: { daysRemaining?: number | null; hoursRemaining?: number | null }) {
  if (typeof params.daysRemaining === "number") {
    if (params.daysRemaining < 0) {
      const daysAgo = Math.abs(params.daysRemaining)
      return daysAgo === 1 ? "Expired yesterday" : `Expired ${daysAgo} days ago`
    }
    if (params.daysRemaining === 0) return "Due today"
    if (params.daysRemaining === 1) return "Due tomorrow"
    return `${params.daysRemaining} days remaining`
  }

  if (typeof params.hoursRemaining === "number") {
    const rounded = Math.abs(params.hoursRemaining).toFixed(1)
    if (params.hoursRemaining < 0) return `Overdue by ${rounded} hrs`
    return `${rounded} hrs remaining`
  }

  return null
}

function addWarning(groups: GroupAccumulator, warning: BookingWarningItem) {
  groups[warning.category].push(warning)
}

function buildExpiryWarning(params: {
  id: string
  code: string
  category: BookingWarningCategory
  title: string
  sourceLabel: string
  dueAt: string | null | undefined
}): BookingWarningItem | null {
  if (!params.dueAt) return null

  const daysRemaining = diffCalendarDays(params.dueAt)
  if (daysRemaining === null) return null

  const severity = getDateSeverity(daysRemaining)
  if (!severity) return null

  const formattedDate = formatDateLabel(params.dueAt)
  const isExpired = daysRemaining < 0

  return {
    id: params.id,
    code: params.code,
    category: params.category,
    severity,
    blocking: severity === "critical",
    title: isExpired ? `${params.title} expired` : `${params.title} due soon`,
    detail: isExpired
      ? `${params.sourceLabel} expired on ${formattedDate}.`
      : `${params.sourceLabel} is due on ${formattedDate}.`,
    source_label: params.sourceLabel,
    due_at: params.dueAt,
    days_remaining: daysRemaining,
    hours_remaining: null,
    countdown_label: getCountdownLabel({ daysRemaining }),
    action_href: null,
    action_label: null,
    observation_id: null,
  } satisfies BookingWarningItem
}

function normalizeObservationSeverity(priority: string | null): {
  severity: BookingWarningSeverity
  blocking: boolean
} {
  const normalized = (priority ?? "medium").trim().toLowerCase()
  if (normalized === "high") return { severity: "critical", blocking: true }
  if (normalized === "low") return { severity: "medium", blocking: false }
  return { severity: "high", blocking: false }
}

function sortWarnings(source: BookingWarningItem[]) {
  return [...source].sort((left, right) => {
    const severityDiff = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
    if (severityDiff !== 0) return severityDiff

    const leftDays = left.days_remaining ?? Number.POSITIVE_INFINITY
    const rightDays = right.days_remaining ?? Number.POSITIVE_INFINITY
    if (leftDays !== rightDays) return leftDays - rightDays

    const leftHours = left.hours_remaining ?? Number.POSITIVE_INFINITY
    const rightHours = right.hours_remaining ?? Number.POSITIVE_INFINITY
    if (leftHours !== rightHours) return leftHours - rightHours

    return left.title.localeCompare(right.title)
  })
}

function buildResponse(params: {
  bookingId: string
  context: BookingWarningsResponse["context"]
  subjectLabels: Record<BookingWarningCategory, string>
  groups: GroupAccumulator
}) {
  const counts: Record<BookingWarningSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  const groupEntries = (Object.keys(GROUP_CONFIG) as BookingWarningCategory[]).map((category) => {
    const warnings = sortWarnings(params.groups[category])
    const blockingCount = warnings.filter((warning) => warning.blocking).length

    warnings.forEach((warning) => {
      counts[warning.severity] += 1
    })

    return {
      category,
      title: GROUP_CONFIG[category].title,
      description: GROUP_CONFIG[category].description,
      subject_label: params.subjectLabels[category],
      warning_count: warnings.length,
      blocking_count: blockingCount,
      warnings,
    }
  })

  const totalCount = Object.values(counts).reduce((sum, value) => sum + value, 0)
  const blockingCount = groupEntries.reduce((sum, group) => sum + group.blocking_count, 0)
  const hasBlockers = blockingCount > 0

  return {
    booking_id: params.bookingId,
    fetched_at: new Date().toISOString(),
    context: params.context,
    summary: {
      status: hasBlockers ? "blocked" : totalCount > 0 ? "warning" : "clear",
      has_blockers: hasBlockers,
      requires_acknowledgement: !hasBlockers && totalCount > 0,
      total_count: totalCount,
      blocking_count: blockingCount,
      counts,
    },
    groups: groupEntries,
  } satisfies BookingWarningsResponse
}

export async function fetchBookingCheckoutWarnings(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  overrides: CheckoutWarningOverrides
): Promise<BookingWarningsResponse> {
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, user_id, instructor_id, aircraft_id")
    .eq("tenant_id", tenantId)
    .eq("id", overrides.bookingId)
    .maybeSingle()

  if (bookingError) throw bookingError
  if (!booking) throw new Error("Booking not found")

  const context = {
    user_id: overrides.userId ?? booking.user_id ?? null,
    instructor_id: overrides.instructorId ?? booking.instructor_id ?? null,
    aircraft_id: overrides.aircraftId ?? booking.aircraft_id ?? null,
  }

  const groups = createEmptyGroups()
  const subjectLabels: Record<BookingWarningCategory, string> = {
    pilot: "Member not selected",
    instructor: context.instructor_id ? "Assigned instructor" : "No instructor assigned",
    aircraft: "Aircraft not selected",
  }

  if (!context.user_id) {
    addWarning(groups, {
      id: "pilot-missing-member",
      code: "pilot_missing_member",
      category: "pilot",
      severity: "critical",
      blocking: true,
      title: "Pilot assignment missing",
      detail: "A member must be assigned before this booking can be checked out.",
      source_label: "Booking member",
      due_at: null,
      days_remaining: null,
      hours_remaining: null,
      countdown_label: null,
      action_href: null,
      action_label: null,
      observation_id: null,
    })
  }

  if (!context.aircraft_id) {
    addWarning(groups, {
      id: "aircraft-missing-aircraft",
      code: "aircraft_missing_aircraft",
      category: "aircraft",
      severity: "critical",
      blocking: true,
      title: "Aircraft assignment missing",
      detail: "An aircraft must be selected before this booking can be checked out.",
      source_label: "Booking aircraft",
      due_at: null,
      days_remaining: null,
      hours_remaining: null,
      countdown_label: null,
      action_href: null,
      action_label: null,
      observation_id: null,
    })
  }

  const [
    memberResult,
    instructorResult,
    aircraftResult,
    componentsResult,
    observationsResult,
    maintenanceVisitsResult,
  ] = await Promise.all([
    context.user_id
      ? supabase
          .from("tenant_users")
          .select(
            "id, is_active, user:users!tenant_users_user_id_fkey(id, first_name, last_name, email, medical_certificate_expiry, class_1_medical_due, class_2_medical_due, BFR_due, pilot_license_expiry)"
          )
          .eq("tenant_id", tenantId)
          .eq("user_id", context.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    context.instructor_id
      ? supabase
          .from("instructors")
          .select(
            "id, user_id, first_name, last_name, status, is_actively_instructing, expires_at, class_1_medical_due_date, instructor_check_due_date, user:users!instructors_user_id_fkey(id, first_name, last_name, email)"
          )
          .eq("tenant_id", tenantId)
          .eq("id", context.instructor_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    context.aircraft_id
      ? supabase
          .from("aircraft")
          .select("id, registration, on_line, total_time_in_service")
          .eq("tenant_id", tenantId)
          .eq("id", context.aircraft_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    context.aircraft_id
      ? supabase
          .from("aircraft_components")
          .select("id, name, status, current_due_date, current_due_hours, notes")
          .eq("tenant_id", tenantId)
          .eq("aircraft_id", context.aircraft_id)
          .eq("status", "active")
          .is("voided_at", null)
      : Promise.resolve({ data: [], error: null }),
    context.aircraft_id
      ? supabase
          .from("observations")
          .select("id, name, priority, stage, reported_date")
          .eq("tenant_id", tenantId)
          .eq("aircraft_id", context.aircraft_id)
          .neq("stage", "closed")
          .order("reported_date", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    context.aircraft_id
      ? supabase
          .from("maintenance_visits")
          .select("id, description, scheduled_for, visit_date, date_out_of_maintenance")
          .eq("tenant_id", tenantId)
          .eq("aircraft_id", context.aircraft_id)
          .is("date_out_of_maintenance", null)
          .order("scheduled_for", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])

  if (memberResult.error) throw memberResult.error
  if (instructorResult.error) throw instructorResult.error
  if (aircraftResult.error) throw aircraftResult.error
  if (componentsResult.error) throw componentsResult.error
  if (observationsResult.error) throw observationsResult.error
  if (maintenanceVisitsResult.error) throw maintenanceVisitsResult.error

  const member = memberResult.data
  const memberUser = pickMaybeOne(member?.user)

  if (context.user_id && !member) {
    addWarning(groups, {
      id: "pilot-member-not-found",
      code: "pilot_member_not_found",
      category: "pilot",
      severity: "critical",
      blocking: true,
      title: "Member record unavailable",
      detail: "The assigned member could not be resolved in this tenant.",
      source_label: "Member status",
      due_at: null,
      days_remaining: null,
      hours_remaining: null,
      countdown_label: null,
      action_href: null,
      action_label: null,
      observation_id: null,
    })
  }

  if (member && !member.is_active) {
    addWarning(groups, {
      id: "pilot-member-inactive",
      code: "pilot_member_inactive",
      category: "pilot",
      severity: "critical",
      blocking: true,
      title: "Member is inactive",
      detail: "The assigned member is not active in this tenant and cannot be checked out for flight.",
      source_label: "Member status",
      due_at: null,
      days_remaining: null,
      hours_remaining: null,
      countdown_label: null,
      action_href: memberUser?.id ? `/members/${memberUser.id}` : null,
      action_label: memberUser?.id ? "Open member" : null,
      observation_id: null,
    })
  }

  if (memberUser) {
    const memberDisplayName = formatPersonName(memberUser)
    subjectLabels.pilot = memberDisplayName
    const medicalDue =
      memberUser.medical_certificate_expiry ??
      memberUser.class_1_medical_due ??
      memberUser.class_2_medical_due ??
      null

    const pilotWarnings = [
      buildExpiryWarning({
        id: "pilot-medical-expiry",
        code: "pilot_medical_expiry",
        category: "pilot",
        title: "Medical certificate",
        sourceLabel: "Medical certificate",
        dueAt: medicalDue,
      }),
      buildExpiryWarning({
        id: "pilot-bfr-expiry",
        code: "pilot_bfr_expiry",
        category: "pilot",
        title: "Flight review (BFR)",
        sourceLabel: "Biennial flight review",
        dueAt: memberUser.BFR_due,
      }),
      buildExpiryWarning({
        id: "pilot-licence-expiry",
        code: "pilot_licence_expiry",
        category: "pilot",
        title: "Pilot licence",
        sourceLabel: "Pilot licence",
        dueAt: memberUser.pilot_license_expiry,
      }),
    ]

    pilotWarnings.filter(isWarningItem).forEach((warning) => addWarning(groups, warning))
  }

  const instructor = instructorResult.data
  const instructorUser = pickMaybeOne(instructor?.user)

  if (context.instructor_id && !instructor) {
    addWarning(groups, {
      id: "instructor-not-found",
      code: "instructor_not_found",
      category: "instructor",
      severity: "critical",
      blocking: true,
      title: "Instructor record unavailable",
      detail: "The selected instructor could not be resolved in this tenant.",
      source_label: "Instructor assignment",
      due_at: null,
      days_remaining: null,
      hours_remaining: null,
      countdown_label: null,
      action_href: null,
      action_label: null,
      observation_id: null,
    })
  }

  if (instructor) {
    const instructorName = formatPersonName({
      first_name: instructorUser?.first_name ?? instructor.first_name,
      last_name: instructorUser?.last_name ?? instructor.last_name,
      email: instructorUser?.email ?? null,
    })
    subjectLabels.instructor = instructorName

    if (instructor.status !== "active") {
      addWarning(groups, {
        id: "instructor-status",
        code: "instructor_status",
        category: "instructor",
        severity: "critical",
        blocking: true,
        title: "Instructor status prevents checkout",
        detail: `${instructorName} is marked as ${instructor.status}.`,
        source_label: "Instructor status",
        due_at: null,
        days_remaining: null,
        hours_remaining: null,
        countdown_label: null,
        action_href: instructor.user_id ? `/members/${instructor.user_id}` : null,
        action_label: instructor.user_id ? "Open instructor" : null,
        observation_id: null,
      })
    }

    if (!instructor.is_actively_instructing) {
      addWarning(groups, {
        id: "instructor-not-active",
        code: "instructor_not_active",
        category: "instructor",
        severity: "critical",
        blocking: true,
        title: "Instructor is not actively instructing",
        detail: `${instructorName} is not currently marked as actively instructing.`,
        source_label: "Instructor availability",
        due_at: null,
        days_remaining: null,
        hours_remaining: null,
        countdown_label: null,
        action_href: instructor.user_id ? `/members/${instructor.user_id}` : null,
        action_label: instructor.user_id ? "Open instructor" : null,
        observation_id: null,
      })
    }

    const instructorWarnings = [
      buildExpiryWarning({
        id: "instructor-licence-expiry",
        code: "instructor_licence_expiry",
        category: "instructor",
        title: "Instructor licence",
        sourceLabel: "Instructor licence",
        dueAt: instructor.expires_at,
      }),
      buildExpiryWarning({
        id: "instructor-medical-expiry",
        code: "instructor_medical_expiry",
        category: "instructor",
        title: "Class 1 medical",
        sourceLabel: "Class 1 medical",
        dueAt: instructor.class_1_medical_due_date,
      }),
      buildExpiryWarning({
        id: "instructor-check-expiry",
        code: "instructor_check_expiry",
        category: "instructor",
        title: "Instructor proficiency check",
        sourceLabel: "Instructor proficiency check",
        dueAt: instructor.instructor_check_due_date,
      }),
    ]

    instructorWarnings.filter(isWarningItem).forEach((warning) => addWarning(groups, warning))
  }

  const aircraft = aircraftResult.data
  if (context.aircraft_id && !aircraft) {
    addWarning(groups, {
      id: "aircraft-not-found",
      code: "aircraft_not_found",
      category: "aircraft",
      severity: "critical",
      blocking: true,
      title: "Aircraft record unavailable",
      detail: "The selected aircraft could not be resolved in this tenant.",
      source_label: "Aircraft status",
      due_at: null,
      days_remaining: null,
      hours_remaining: null,
      countdown_label: null,
      action_href: null,
      action_label: null,
      observation_id: null,
    })
  }

  if (aircraft) {
    subjectLabels.aircraft = aircraft.registration
    if (!aircraft.on_line) {
      addWarning(groups, {
        id: "aircraft-offline",
        code: "aircraft_offline",
        category: "aircraft",
        severity: "critical",
        blocking: true,
        title: "Aircraft is offline",
        detail: `${aircraft.registration} is not online for scheduling.`,
        source_label: "Aircraft availability",
        due_at: null,
        days_remaining: null,
        hours_remaining: null,
        countdown_label: null,
        action_href: `/aircraft/${aircraft.id}`,
        action_label: "Open aircraft",
        observation_id: null,
      })
    }

  }

  for (const visit of maintenanceVisitsResult.data ?? []) {
    const startDate = visit.scheduled_for ?? visit.visit_date
    addWarning(groups, {
      id: `aircraft-maintenance-${visit.id}`,
      code: "aircraft_in_maintenance",
      category: "aircraft",
      severity: "critical",
      blocking: true,
      title: "Aircraft is currently in maintenance",
      detail: startDate
        ? `${visit.description} started ${formatDateLabel(startDate)} and is still open.`
        : `${visit.description} is still open in maintenance.`,
      source_label: "Maintenance visit",
      due_at: startDate,
      days_remaining: startDate ? diffCalendarDays(startDate) : null,
      hours_remaining: null,
      countdown_label: null,
      action_href: aircraft?.id ? `/aircraft/${aircraft.id}` : null,
      action_label: aircraft?.id ? "Open aircraft" : null,
      observation_id: null,
    })
  }

  const totalTimeInService = Number(aircraft?.total_time_in_service ?? 0)
  for (const component of componentsResult.data ?? []) {
    const dueDateDays = component.current_due_date ? diffCalendarDays(component.current_due_date) : null
    const dueHoursRemaining =
      typeof component.current_due_hours === "number"
        ? component.current_due_hours - totalTimeInService
        : null

    const severity = getMostUrgentSeverity(
      typeof dueDateDays === "number" ? getDateSeverity(dueDateDays) : null,
      typeof dueHoursRemaining === "number" ? getHoursSeverity(dueHoursRemaining) : null
    )

    if (!severity) continue

    const dueByDate =
      component.current_due_date && dueDateDays !== null
        ? `Due date ${formatDateLabel(component.current_due_date)}`
        : null
    const dueByHours =
      typeof dueHoursRemaining === "number"
        ? dueHoursRemaining < 0
          ? `Overdue by ${Math.abs(dueHoursRemaining).toFixed(1)} hrs`
          : `Due in ${dueHoursRemaining.toFixed(1)} hrs`
        : null
    const detailParts = [dueByDate, dueByHours, component.notes?.trim() || null].filter(Boolean)

    addWarning(groups, {
      id: `aircraft-component-${component.id}`,
      code: "aircraft_component_due",
      category: "aircraft",
      severity,
      blocking: severity === "critical",
      title:
        severity === "critical"
          ? `${component.name} is overdue`
          : `${component.name} is approaching its maintenance limit`,
      detail: detailParts.join(". "),
      source_label: "Maintenance item",
      due_at: component.current_due_date,
      days_remaining: dueDateDays,
      hours_remaining: dueHoursRemaining,
      countdown_label: getCountdownLabel({
        daysRemaining: dueDateDays,
        hoursRemaining: dueDateDays === null ? dueHoursRemaining : null,
      }),
      action_href: aircraft?.id ? `/aircraft/${aircraft.id}` : null,
      action_label: aircraft?.id ? "Open aircraft" : null,
      observation_id: null,
    })
  }

  for (const observation of observationsResult.data ?? []) {
    const severityMeta = normalizeObservationSeverity(observation.priority)
    const reportedDate = observation.reported_date ? formatDateLabel(observation.reported_date) : null
    addWarning(groups, {
      id: `aircraft-observation-${observation.id}`,
      code: "aircraft_observation_open",
      category: "aircraft",
      severity: severityMeta.severity,
      blocking: severityMeta.blocking,
      title: observation.name,
      detail: `${observation.stage.charAt(0).toUpperCase()}${observation.stage.slice(1)} observation${
        reportedDate ? ` reported ${reportedDate}` : ""
      }.`,
      source_label: observation.priority ? `${observation.priority} priority observation` : "Aircraft observation",
      due_at: observation.reported_date,
      days_remaining: observation.reported_date ? diffCalendarDays(observation.reported_date) : null,
      hours_remaining: null,
      countdown_label: null,
      action_href: aircraft?.id ? `/aircraft/${aircraft.id}` : null,
      action_label: "View observation",
      observation_id: observation.id,
    })
  }

  return buildResponse({
    bookingId: overrides.bookingId,
    context,
    subjectLabels,
    groups,
  })
}
