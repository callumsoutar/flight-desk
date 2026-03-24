import { Heading, Section, Text } from "@react-email/components"
import * as React from "react"

import { formatBookingDateRange } from "@/lib/email/format-booking-time"

import { TemplateShell } from "./template-shell"

export type BookingCancelledEmailProps = {
  tenantName: string
  logoUrl?: string | null
  memberFirstName: string
  bookingId: string
  startTime: string
  endTime: string
  timezone: string
  aircraftRegistration?: string | null
  cancellationReason: string
  contactEmail?: string | null
}

export function BookingCancelledEmail(props: BookingCancelledEmailProps) {
  const when = formatBookingDateRange(props.startTime, props.endTime, props.timezone)
  return (
    <TemplateShell preview={`Booking cancelled for ${when.date}`} tenantName={props.tenantName} logoUrl={props.logoUrl}>
      <Heading style={{ color: "#b91c1c", margin: "0 0 8px" }}>Booking Cancelled</Heading>
      <Text style={{ color: "#18181b" }}>Hi {props.memberFirstName}, this booking has been cancelled.</Text>
      <Section>
        <Text style={{ color: "#18181b", margin: 0 }}>{when.full}</Text>
        <Text style={{ color: "#71717a", margin: 0 }}>Booking ID: {props.bookingId}</Text>
        {props.aircraftRegistration ? (
          <Text style={{ color: "#71717a", margin: 0 }}>Aircraft: {props.aircraftRegistration}</Text>
        ) : null}
      </Section>
      <Text style={{ color: "#18181b" }}>Reason: {props.cancellationReason}</Text>
      {props.contactEmail ? (
        <Text style={{ color: "#71717a" }}>Contact: {props.contactEmail}</Text>
      ) : null}
    </TemplateShell>
  )
}
