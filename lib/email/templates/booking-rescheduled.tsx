import { Button, Heading, Section, Text } from "@react-email/components"
import * as React from "react"

import { formatBookingDateRange } from "@/lib/email/format-booking-time"

import { TemplateShell } from "./template-shell"

export type BookingRescheduledEmailProps = {
  tenantName: string
  logoUrl?: string | null
  memberFirstName: string
  bookingId: string
  previousStartTime: string
  previousEndTime: string
  newStartTime: string
  newEndTime: string
  timezone: string
  aircraftRegistration?: string | null
  instructorName?: string | null
  bookingUrl: string
  changedFields: string[]
}

export function BookingRescheduledEmail(props: BookingRescheduledEmailProps) {
  const previous = formatBookingDateRange(props.previousStartTime, props.previousEndTime, props.timezone)
  const next = formatBookingDateRange(props.newStartTime, props.newEndTime, props.timezone)

  return (
    <TemplateShell preview={`Booking updated to ${next.date}`} tenantName={props.tenantName} logoUrl={props.logoUrl}>
      <Heading style={{ color: "#18181b", margin: "0 0 8px" }}>Your booking has been updated</Heading>
      <Text style={{ color: "#18181b" }}>Hi {props.memberFirstName}, your booking details were changed.</Text>
      <Section>
        <Text style={{ color: "#71717a", margin: 0 }}>Before: {previous.full}</Text>
        <Text style={{ color: "#71717a", margin: 0 }}>After: {next.full}</Text>
        <Text style={{ color: "#71717a", margin: 0 }}>Changed: {props.changedFields.join(", ") || "Details"}</Text>
      </Section>
      <Button href={props.bookingUrl} style={{ backgroundColor: "#2563eb", color: "#ffffff", padding: "10px 14px", borderRadius: "6px" }}>
        View Updated Booking
      </Button>
    </TemplateShell>
  )
}
