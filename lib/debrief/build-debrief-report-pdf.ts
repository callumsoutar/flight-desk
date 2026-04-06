import "server-only"

import type {
  DebriefReportPdfExperienceRow,
  DebriefReportPdfProps,
} from "@/components/debrief/debrief-report-pdf"
import { htmlToPlainText } from "@/lib/email/html-to-plain-text"
import { resolveTenantLogoSignedUrl } from "@/lib/settings/logo-storage-admin"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type {
  FlightExperienceEntryWithType,
  LessonProgressWithInstructor,
} from "@/lib/types/debrief"
import { formatOrdinal } from "@/lib/utils"
import { formatDate } from "@/lib/utils/date-format"

function resolveFlightTimeHours(booking: BookingWithRelations): number | null {
  const candidates = [
    booking.billing_hours,
    booking.flight_time_hobbs,
    booking.flight_time_tach,
    booking.flight_time_airswitch,
    booking.dual_time,
    booking.solo_time,
  ]

  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value
  }

  return null
}

function formatExperienceValue(unit: FlightExperienceEntryWithType["unit"], value: number) {
  if (!Number.isFinite(value)) return "-"
  if (unit === "hours") return `${value.toFixed(1)}h`
  if (unit === "landings") return value === 1 ? "1 landing" : `${value} landings`
  return String(value)
}

function formatDirectoryName(user: {
  first_name: string | null
  last_name: string | null
  email?: string | null
} | null | undefined) {
  if (!user) return "-"
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "-"
}

function instructorDisplayName(
  lessonProgress: LessonProgressWithInstructor | null,
  booking: BookingWithRelations
) {
  const lessonProgressInstructor = lessonProgress?.instructor
  if (lessonProgressInstructor) {
    return formatDirectoryName({
      first_name: lessonProgressInstructor.user?.first_name ?? lessonProgressInstructor.first_name,
      last_name: lessonProgressInstructor.user?.last_name ?? lessonProgressInstructor.last_name,
      email: lessonProgressInstructor.user?.email ?? null,
    })
  }

  const bookingInstructor = booking.instructor
  if (bookingInstructor) {
    return formatDirectoryName({
      first_name: bookingInstructor.user?.first_name ?? bookingInstructor.first_name,
      last_name: bookingInstructor.user?.last_name ?? bookingInstructor.last_name,
      email: bookingInstructor.user?.email ?? null,
    })
  }

  return "-"
}

function outcomeLabelFromStatus(status: LessonProgressWithInstructor["status"] | null | undefined) {
  if (status === "pass") return "Pass"
  if (status === "not yet competent") return "Not Yet Competent"
  return "-"
}

export function formatAttemptLabel(attempt: number | null | undefined): string | null {
  if (attempt == null || !Number.isFinite(attempt)) return null
  return formatOrdinal(attempt)
}

export function buildDebriefPdfFilename(lessonName: string) {
  const safeLessonSlug = lessonName.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 48) || "debrief"
  return `flight-debrief-${safeLessonSlug}.pdf`
}

export async function buildDebriefReportPdfProps({
  tenantName,
  logoUrl,
  timeZone,
  booking,
  lessonProgress,
  flightExperiences,
}: {
  tenantName: string
  logoUrl?: string | null
  timeZone: string
  booking: BookingWithRelations
  lessonProgress: LessonProgressWithInstructor
  flightExperiences: FlightExperienceEntryWithType[]
}): Promise<DebriefReportPdfProps> {
  const lessonName = booking.lesson?.name ?? "Training Flight"
  const resolvedLogoUrl = await resolveTenantLogoSignedUrl(logoUrl ?? null)
  const flightTimeHours = resolveFlightTimeHours(booking)

  return {
    tenantName,
    logoUrl: resolvedLogoUrl,
    lessonName,
    sessionDate: formatDate(booking.start_time ?? null, timeZone, "long") || "-",
    studentName: formatDirectoryName(booking.student),
    instructorName: instructorDisplayName(lessonProgress, booking),
    aircraftRegistration: booking.checked_out_aircraft?.registration || booking.aircraft?.registration || "-",
    flightTimeLabel: flightTimeHours != null ? `${flightTimeHours.toFixed(1)}h` : "-",
    outcomeLabel: outcomeLabelFromStatus(lessonProgress.status),
    attemptLabel: formatAttemptLabel(lessonProgress.attempt),
    instructorComments: htmlToPlainText(lessonProgress.instructor_comments ?? ""),
    lessonHighlights: htmlToPlainText(lessonProgress.lesson_highlights ?? ""),
    airmanship: htmlToPlainText(lessonProgress.airmanship ?? ""),
    areasForImprovement: htmlToPlainText(lessonProgress.areas_for_improvement ?? ""),
    focusNextLesson: htmlToPlainText(lessonProgress.focus_next_lesson ?? ""),
    weatherConditions: htmlToPlainText(lessonProgress.weather_conditions ?? ""),
    safetyConcerns: htmlToPlainText(lessonProgress.safety_concerns ?? ""),
    flightExperiences: flightExperiences.map<DebriefReportPdfExperienceRow>((entry) => ({
      name: entry.experience_type?.name ?? "Experience",
      detail: [entry.notes, entry.conditions].filter(Boolean).join(" · "),
      valueLabel: formatExperienceValue(entry.unit, entry.value),
    })),
  }
}
