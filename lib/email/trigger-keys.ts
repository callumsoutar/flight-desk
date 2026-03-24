export const EMAIL_TRIGGER_KEYS = {
  BOOKING_CONFIRMED: "booking_confirmed",
  BOOKING_CANCELLED: "booking_cancelled",
  BOOKING_RESCHEDULED: "booking_rescheduled",
  BOOKING_UPDATED: "booking_updated",
  CHECKIN_APPROVED: "checkin_approved",
  INVOICE_SEND: "invoice_send",
  STATEMENT_SEND: "statement_send",
} as const

export type EmailTriggerKey = typeof EMAIL_TRIGGER_KEYS[keyof typeof EMAIL_TRIGGER_KEYS]

export const EMAIL_TRIGGER_LABELS: Record<EmailTriggerKey, string> = {
  booking_confirmed: "Booking Confirmed",
  booking_cancelled: "Booking Cancelled",
  booking_rescheduled: "Booking Rescheduled",
  booking_updated: "Booking Updated",
  checkin_approved: "Check-in Approved (Invoice Created)",
  invoice_send: "Send Invoice",
  statement_send: "Send Statement",
}

export const EMAIL_TRIGGER_DESCRIPTIONS: Record<EmailTriggerKey, string> = {
  booking_confirmed: "Sent to the member when a booking is confirmed by staff.",
  booking_cancelled: "Sent to the member when a booking is cancelled.",
  booking_rescheduled: "Sent to the member when the booking time is rescheduled.",
  booking_updated: "Sent to the member when booking details (aircraft, instructor, purpose, description, lesson) change.",
  checkin_approved: "Sent to the member when their flight is checked in and an invoice is generated.",
  invoice_send: "Sent when staff manually emails an invoice to a member.",
  statement_send: "Sent when staff manually emails an account statement to a member.",
}

export const AUTOMATIC_TRIGGERS: EmailTriggerKey[] = [
  EMAIL_TRIGGER_KEYS.BOOKING_CONFIRMED,
  EMAIL_TRIGGER_KEYS.BOOKING_CANCELLED,
  EMAIL_TRIGGER_KEYS.BOOKING_RESCHEDULED,
  EMAIL_TRIGGER_KEYS.BOOKING_UPDATED,
  EMAIL_TRIGGER_KEYS.CHECKIN_APPROVED,
]

export const MANUAL_TRIGGERS: EmailTriggerKey[] = [
  EMAIL_TRIGGER_KEYS.INVOICE_SEND,
  EMAIL_TRIGGER_KEYS.STATEMENT_SEND,
]
