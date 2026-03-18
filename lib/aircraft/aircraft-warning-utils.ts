import "server-only"

import type { BookingWarningItem, BookingWarningSeverity } from "@/lib/types/booking-warnings"

type AircraftWarningAircraft = {
  id: string
  registration: string
  on_line: boolean | null
  total_time_in_service: number | null
}

type AircraftWarningComponent = {
  id: string
  name: string
  current_due_date: string | null
  current_due_hours: number | null
  notes: string | null
}

type AircraftWarningObservation = {
  id: string
  name: string
  priority: string | null
  stage: string
  reported_date: string | null
}

type AircraftWarningMaintenanceVisit = {
  id: string
  description: string
  scheduled_for: string | null
  visit_date: string | null
}

const SEVERITY_ORDER: Record<BookingWarningSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
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

function diffCalendarDays(targetIso: string, todayKey: string) {
  const target = new Date(targetIso)
  if (Number.isNaN(target.getTime())) return null
  const targetKey = targetIso.slice(0, 10)
  const msTarget = Date.UTC(
    parseInt(targetKey.slice(0, 4)),
    parseInt(targetKey.slice(5, 7)) - 1,
    parseInt(targetKey.slice(8, 10))
  )
  const msToday = Date.UTC(
    parseInt(todayKey.slice(0, 4)),
    parseInt(todayKey.slice(5, 7)) - 1,
    parseInt(todayKey.slice(8, 10))
  )
  return Math.round((msTarget - msToday) / 86_400_000)
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

export function buildAircraftWarnings(params: {
  aircraft: AircraftWarningAircraft
  components: AircraftWarningComponent[]
  observations: AircraftWarningObservation[]
  maintenanceVisits: AircraftWarningMaintenanceVisit[]
  todayKey: string
}) {
  const { aircraft, components, observations, maintenanceVisits, todayKey } = params
  const warnings: BookingWarningItem[] = []

  if (!aircraft.on_line) {
    warnings.push({
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

  for (const visit of maintenanceVisits) {
    const startDate = visit.scheduled_for ?? visit.visit_date
    warnings.push({
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
      days_remaining: startDate ? diffCalendarDays(startDate, todayKey) : null,
      hours_remaining: null,
      countdown_label: null,
      action_href: `/aircraft/${aircraft.id}`,
      action_label: "Open aircraft",
      observation_id: null,
    })
  }

  const totalTimeInService = Number(aircraft.total_time_in_service ?? 0)
  for (const component of components) {
    const dueDateDays = component.current_due_date ? diffCalendarDays(component.current_due_date, todayKey) : null
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

    warnings.push({
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
      action_href: `/aircraft/${aircraft.id}`,
      action_label: "Open aircraft",
      observation_id: null,
    })
  }

  for (const observation of observations) {
    const severityMeta = normalizeObservationSeverity(observation.priority)
    const reportedDate = observation.reported_date ? formatDateLabel(observation.reported_date) : null
    warnings.push({
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
      days_remaining: observation.reported_date ? diffCalendarDays(observation.reported_date, todayKey) : null,
      hours_remaining: null,
      countdown_label: null,
      action_href: `/aircraft/${aircraft.id}`,
      action_label: "View observation",
      observation_id: observation.id,
    })
  }

  return sortWarnings(warnings)
}
