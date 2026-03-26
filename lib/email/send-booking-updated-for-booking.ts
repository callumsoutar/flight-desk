import { render } from "@react-email/render"
import type { SupabaseClient } from "@supabase/supabase-js"

import { formatBookingDateRange } from "@/lib/email/format-booking-time"
import type { BookingUpdatedChange } from "@/lib/email/build-booking-updated-changes"
import { getRequiredPublicAppUrl } from "@/lib/env/public-app-url"
import { getTriggerConfig } from "@/lib/email/get-trigger-config"
import { interpolateSubject } from "@/lib/email/interpolate-subject"
import { sendEmail } from "@/lib/email/send-email"
import { BookingUpdatedEmail } from "@/lib/email/templates/booking-updated"
import { EMAIL_TRIGGER_KEYS } from "@/lib/email/trigger-keys"
import type { Database } from "@/lib/types"

type TenantRow = {
  name?: string | null
  logo_url?: string | null
  contact_email?: string | null
  timezone?: string | null
}

type BookingRecord = Record<string, unknown>

function formatInstructorName(instructor: {
  first_name?: string | null
  last_name?: string | null
  user?: { first_name?: string | null; last_name?: string | null } | null
} | null): string | null {
  if (!instructor) return null
  const fromUser = [instructor.user?.first_name, instructor.user?.last_name].filter(Boolean).join(" ").trim()
  if (fromUser) return fromUser
  const direct = [instructor.first_name, instructor.last_name].filter(Boolean).join(" ").trim()
  return direct || null
}

export type BookingUpdatedSendResult =
  | { sent: true }
  | { sent: false; reason: "trigger_disabled" | "no_member_email" | "no_changes" }

export async function sendBookingUpdatedEmailForBooking(args: {
  supabase: SupabaseClient<Database>
  tenantId: string
  bookingId: string
  bookingUserId: string | null | undefined
  triggeredBy: string
  booking: BookingRecord
  tenant: TenantRow | null
  changes: BookingUpdatedChange[]
}): Promise<BookingUpdatedSendResult> {
  const { supabase, tenantId, bookingId, bookingUserId, triggeredBy, booking, tenant, changes } = args

  if (changes.length === 0) return { sent: false, reason: "no_changes" }

  const triggerConfig = await getTriggerConfig(supabase, tenantId, EMAIL_TRIGGER_KEYS.BOOKING_UPDATED)
  const member =
    (booking.student as { first_name?: string | null; email?: string | null } | null) ?? null
  const memberEmail = member?.email?.trim() || null
  const memberFirstName = member?.first_name ?? "there"
  const instructor =
    (booking.instructor as
      | {
          first_name?: string | null
          last_name?: string | null
          user?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null
        }
      | null) ?? null
  const instructorEmail = instructor?.user?.email?.trim() || null

  if (!triggerConfig.is_enabled) {
    return { sent: false, reason: "trigger_disabled" }
  }
  if (!memberEmail) {
    return { sent: false, reason: "no_member_email" }
  }

  const timezone = tenant?.timezone ?? "Pacific/Auckland"
  const bookingDate = formatBookingDateRange(
    String(booking.start_time),
    String(booking.end_time),
    timezone
  )
  const baseUrl = getRequiredPublicAppUrl()
  const bookingUrl = `${baseUrl}/bookings/${bookingId}`

  const html = await render(
    BookingUpdatedEmail({
      tenantName: tenant?.name ?? "Your Aero Club",
      logoUrl: tenant?.logo_url,
      memberFirstName,
      bookingId,
      startTime: String(booking.start_time),
      endTime: String(booking.end_time),
      timezone,
      bookingUrl,
      changes,
      aircraftDisplay:
        ((booking.aircraft as { registration?: string | null } | null)?.registration ?? null),
      instructorName: formatInstructorName(instructor),
      flightType: ((booking.flight_type as { name?: string | null } | null)?.name ?? null),
      lessonName: ((booking.lesson as { name?: string | null } | null)?.name ?? null),
      purpose: String(booking.purpose ?? ""),
      description: (booking.remarks as string | null) ?? null,
    })
  )

  const subject = triggerConfig.subject_template
    ? interpolateSubject(triggerConfig.subject_template, {
        tenantName: tenant?.name ?? undefined,
        memberFirstName,
        bookingId,
      })
    : `Booking Updated - ${bookingDate.date}`

  await sendEmail({
    supabase,
    tenantId,
    triggerKey: EMAIL_TRIGGER_KEYS.BOOKING_UPDATED,
    to: memberEmail,
    subject,
    html,
    bookingId,
    userId: bookingUserId ?? undefined,
    triggeredBy,
    fromName: triggerConfig.from_name ?? tenant?.name ?? undefined,
    replyTo: triggerConfig.reply_to ?? tenant?.contact_email ?? undefined,
    cc: triggerConfig.cc_emails,
  })

  if (triggerConfig.notify_instructor && instructorEmail) {
    await sendEmail({
      supabase,
      tenantId,
      triggerKey: EMAIL_TRIGGER_KEYS.BOOKING_UPDATED,
      to: instructorEmail,
      subject,
      html,
      bookingId,
      userId: bookingUserId ?? undefined,
      triggeredBy,
      fromName: triggerConfig.from_name ?? tenant?.name ?? undefined,
      replyTo: triggerConfig.reply_to ?? tenant?.contact_email ?? undefined,
      cc: triggerConfig.cc_emails,
    })
  }

  return { sent: true }
}
