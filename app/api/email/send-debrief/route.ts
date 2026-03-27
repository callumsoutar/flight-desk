import { render } from "@react-email/render"
import { pdf } from "@react-pdf/renderer"
import type { DocumentProps } from "@react-pdf/renderer"
import * as React from "react"
import { z } from "zod"

import DebriefReportPDF, { formatAttemptLabel } from "@/components/debrief/debrief-report-pdf"
import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchDebriefData } from "@/lib/debrief/fetch-debrief-data"
import { htmlToPlainText } from "@/lib/email/html-to-plain-text"
import { getTriggerConfig } from "@/lib/email/get-trigger-config"
import { interpolateSubject } from "@/lib/email/interpolate-subject"
import { sendEmail } from "@/lib/email/send-email"
import { DebriefEmail } from "@/lib/email/templates/debrief-email"
import { EMAIL_TRIGGER_KEYS } from "@/lib/email/trigger-keys"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type { FlightExperienceEntryWithType, LessonProgressWithInstructor } from "@/lib/types/debrief"
import { logError } from "@/lib/security/logger"
import { enforceRateLimit } from "@/lib/security/rate-limit"
import { formatDate } from "@/lib/utils/date-format"

export const dynamic = "force-dynamic"

const payloadSchema = z.strictObject({
  booking_id: z.string().uuid(),
}).strict()

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
  if (!Number.isFinite(value)) return "—"
  if (unit === "hours") return `${value.toFixed(1)}h`
  if (unit === "landings") return value === 1 ? "1 landing" : `${value} landings`
  return String(value)
}

function formatDirectoryName(user: {
  first_name: string | null
  last_name: string | null
  email?: string | null
} | null | undefined) {
  if (!user) return "—"
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "—"
}

function instructorDisplayName(
  lessonProgress: LessonProgressWithInstructor | null,
  booking: BookingWithRelations
): string {
  const lp = lessonProgress?.instructor
  if (lp) {
    return formatDirectoryName({
      first_name: lp.user?.first_name ?? lp.first_name,
      last_name: lp.user?.last_name ?? lp.last_name,
      email: lp.user?.email ?? null,
    })
  }
  const bi = booking.instructor
  if (bi) {
    return formatDirectoryName({
      first_name: bi.user?.first_name ?? bi.first_name,
      last_name: bi.user?.last_name ?? bi.last_name,
      email: bi.user?.email ?? null,
    })
  }
  return "—"
}

function outcomeLabelFromStatus(status: LessonProgressWithInstructor["status"] | null | undefined) {
  if (status === "pass") return "Pass"
  if (status === "not yet competent") return "Not Yet Competent"
  return "—"
}

function truncatePreview(text: string, max = 320) {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export async function POST(request: Request) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, user, tenantId } = session.context

  const rateLimitResult = enforceRateLimit({
    key: `email:send-debrief:${tenantId}:${user.id}`,
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimitResult.ok) {
    return noStoreJson(
      { error: "Too many email requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "retry-after": String(rateLimitResult.retryAfterSeconds),
        },
      }
    )
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const bookingId = parsed.data.booking_id

  let data: Awaited<ReturnType<typeof fetchDebriefData>>
  try {
    data = await fetchDebriefData(supabase, tenantId, bookingId)
  } catch (error) {
    logError("[email] Failed to load debrief for send-debrief", { error, tenantId, bookingId })
    return noStoreJson({ error: "Failed to load debrief" }, { status: 500 })
  }

  const booking = data.booking
  if (!booking) {
    return noStoreJson({ error: "Booking not found" }, { status: 404 })
  }

  if (!data.lessonProgress) {
    return noStoreJson({ error: "No debrief has been written for this booking yet" }, { status: 422 })
  }

  const triggerConfig = await getTriggerConfig(supabase, tenantId, EMAIL_TRIGGER_KEYS.DEBRIEF_SEND)
  if (!triggerConfig.is_enabled) {
    return noStoreJson({ error: "Debrief email trigger is disabled" }, { status: 409 })
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, logo_url, contact_email, timezone")
    .eq("id", tenantId)
    .maybeSingle()

  const timeZone = tenant?.timezone?.trim() || "Pacific/Auckland"
  const tenantName = tenant?.name ?? "Your Aero Club"

  const student = booking.student
  const memberEmail = student?.email?.trim() || null
  if (!memberEmail) {
    return noStoreJson({ error: "Member email is not available for this booking" }, { status: 422 })
  }

  const lessonProgress = data.lessonProgress
  const lessonName = booking.lesson?.name ?? "Training Flight"
  const sessionDateLong = formatDate(booking.start_time ?? null, timeZone, "long") || "—"
  const sessionDateMedium = formatDate(booking.start_time ?? null, timeZone, "medium") || "—"
  const instructorName = instructorDisplayName(lessonProgress, booking)
  const studentName = formatDirectoryName(student)
  const aircraftReg =
    booking.checked_out_aircraft?.registration || booking.aircraft?.registration || "—"
  const flightHours = resolveFlightTimeHours(booking)
  const flightTimeLabel = flightHours != null ? `${flightHours.toFixed(1)}h` : "—"
  const outcomeLabel = outcomeLabelFromStatus(lessonProgress.status)
  const attemptLabel = formatAttemptLabel(lessonProgress.attempt)

  const focusPlain = htmlToPlainText(lessonProgress.focus_next_lesson ?? "")
  const focusPreview = focusPlain ? truncatePreview(focusPlain) : null

  const pdfProps = {
    tenantName,
    logoUrl: tenant?.logo_url,
    lessonName,
    sessionDate: sessionDateLong,
    studentName,
    instructorName,
    aircraftRegistration: aircraftReg,
    flightTimeLabel,
    outcomeLabel,
    attemptLabel,
    instructorComments: htmlToPlainText(lessonProgress.instructor_comments ?? ""),
    lessonHighlights: htmlToPlainText(lessonProgress.lesson_highlights ?? ""),
    airmanship: htmlToPlainText(lessonProgress.airmanship ?? ""),
    areasForImprovement: htmlToPlainText(lessonProgress.areas_for_improvement ?? ""),
    focusNextLesson: htmlToPlainText(lessonProgress.focus_next_lesson ?? ""),
    weatherConditions: htmlToPlainText(lessonProgress.weather_conditions ?? ""),
    safetyConcerns: htmlToPlainText(lessonProgress.safety_concerns ?? ""),
    flightExperiences: data.flightExperiences.map((entry) => ({
      name: entry.experience_type?.name ?? "Experience",
      detail: [entry.notes, entry.conditions].filter(Boolean).join(" · "),
      valueLabel: formatExperienceValue(entry.unit, entry.value),
    })),
  }

  const safeLessonSlug = lessonName.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 48) || "debrief"
  const pdfFilename = `flight-debrief-${safeLessonSlug}.pdf`

  try {
    const pdfDocument = React.createElement(DebriefReportPDF, pdfProps)
    const pdfBlob = await pdf(pdfDocument as unknown as React.ReactElement<DocumentProps>).toBlob()
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    const html = await render(
      DebriefEmail({
        tenantName,
        logoUrl: tenant?.logo_url,
        memberFirstName: student?.first_name ?? "there",
        lessonName,
        sessionDate: sessionDateLong,
        instructorName,
        aircraftRegistration: aircraftReg,
        flightTimeLabel,
        outcomeLabel,
        attemptLabel,
        focusNextLessonPreview: focusPreview,
        contactEmail: tenant?.contact_email,
      })
    )

    const subject = triggerConfig.subject_template
      ? interpolateSubject(triggerConfig.subject_template, {
          tenantName,
          memberFirstName: student?.first_name ?? undefined,
          memberLastName: student?.last_name ?? undefined,
          lessonName,
          flightDate: sessionDateMedium,
          instructorName,
          aircraftRegistration: aircraftReg,
        })
      : `Flight debrief — ${lessonName}`

    const result = await sendEmail({
      supabase,
      tenantId,
      triggerKey: EMAIL_TRIGGER_KEYS.DEBRIEF_SEND,
      to: memberEmail,
      subject,
      html,
      bookingId,
      userId: booking.user_id ?? undefined,
      triggeredBy: user.id,
      fromName: triggerConfig.from_name ?? tenantName,
      replyTo: triggerConfig.reply_to ?? tenant?.contact_email ?? undefined,
      cc: triggerConfig.cc_emails,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          content_type: "application/pdf",
        },
      ],
      metadata: { source: "manual_send_debrief" },
    })

    if (!result.ok) {
      return noStoreJson({ error: "Failed to send email" }, { status: 500 })
    }

    return noStoreJson({ ok: true, messageId: result.messageId })
  } catch (error) {
    logError("[email] Failed to render or send debrief email", { error, tenantId, bookingId })
    return noStoreJson({ error: "Failed to send debrief email" }, { status: 500 })
  }
}
