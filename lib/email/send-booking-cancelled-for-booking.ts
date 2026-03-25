import { render } from "@react-email/render"
import type { SupabaseClient } from "@supabase/supabase-js"

import { formatBookingDateRange } from "@/lib/email/format-booking-time"
import { getTriggerConfig } from "@/lib/email/get-trigger-config"
import { interpolateSubject } from "@/lib/email/interpolate-subject"
import { sendEmail } from "@/lib/email/send-email"
import { BookingCancelledEmail } from "@/lib/email/templates/booking-cancelled"
import { EMAIL_TRIGGER_KEYS } from "@/lib/email/trigger-keys"
import type { Database } from "@/lib/types"

type TenantRow = {
  name?: string | null
  logo_url?: string | null
  contact_email?: string | null
  timezone?: string | null
}

type BookingRecord = Record<string, unknown>

export type BookingCancelledSendResult =
  | { sent: true }
  | { sent: false; reason: "trigger_disabled" | "no_member_email" }

/**
 * Sends the booking-cancelled member (and optionally instructor) emails using the same
 * trigger config and template as when a booking is cancelled via PATCH.
 */
export async function sendBookingCancelledEmailForBooking(args: {
  supabase: SupabaseClient<Database>
  tenantId: string
  bookingId: string
  bookingUserId: string | null | undefined
  triggeredBy: string
  booking: BookingRecord
  tenant: TenantRow | null
}): Promise<BookingCancelledSendResult> {
  const { supabase, tenantId, bookingId, bookingUserId, triggeredBy, booking, tenant } = args

  const triggerConfig = await getTriggerConfig(supabase, tenantId, EMAIL_TRIGGER_KEYS.BOOKING_CANCELLED)
  const member =
    (booking.student as { first_name?: string | null; email?: string | null } | null) ?? null
  const memberEmail = member?.email?.trim() || null
  const memberFirstName = member?.first_name ?? "there"
  const instructor =
    (booking.instructor as
      | { first_name?: string | null; last_name?: string | null; user?: { email?: string | null } | null }
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
  const unsubscribeUrl = undefined // Could be added if available

  const html = await render(
    BookingCancelledEmail({
      tenantName: tenant?.name ?? "Your Aero Club",
      logoUrl: tenant?.logo_url,
      memberFirstName,
      bookingId,
      startTime: String(booking.start_time),
      endTime: String(booking.end_time),
      timezone,
      aircraftRegistration:
        ((booking.aircraft as { registration?: string | null } | null)?.registration ?? null),
      cancellationReason: String(booking.cancellation_reason ?? "No reason provided"),
      cancelledNotes: (booking.cancelled_notes as string | null) ?? null,
      contactEmail: tenant?.contact_email,
      unsubscribeUrl,
    })
  )

  const subject = triggerConfig.subject_template
    ? interpolateSubject(triggerConfig.subject_template, {
        tenantName: tenant?.name ?? undefined,
        memberFirstName,
        bookingId,
      })
    : `Booking Cancelled - ${bookingDate.date}`

  await sendEmail({
    supabase,
    tenantId,
    triggerKey: EMAIL_TRIGGER_KEYS.BOOKING_CANCELLED,
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
      triggerKey: EMAIL_TRIGGER_KEYS.BOOKING_CANCELLED,
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
