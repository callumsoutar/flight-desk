import { Button, Heading, Section, Text } from "@react-email/components"
import * as React from "react"

import { TemplateShell } from "./template-shell"

export type CheckinApprovedEmailProps = {
  tenantName: string
  logoUrl?: string | null
  memberFirstName: string
  bookingId: string
  flightDate: string
  aircraftRegistration?: string | null
  flightTime?: number | null
  invoiceNumber?: string | null
  invoiceTotal?: number | null
  currency: string
  invoiceUrl: string
  dueDate?: string | null
}

function formatMoney(value: number | null | undefined, currency: string) {
  if (typeof value !== "number") return "N/A"
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value)
}

export function CheckinApprovedEmail(props: CheckinApprovedEmailProps) {
  return (
    <TemplateShell preview="Flight complete - invoice ready" tenantName={props.tenantName} logoUrl={props.logoUrl}>
      <Heading style={{ color: "#18181b", margin: "0 0 8px" }}>Flight complete - invoice ready</Heading>
      <Text style={{ color: "#18181b" }}>Hi {props.memberFirstName}, your check-in is approved and invoice is ready.</Text>
      <Section>
        <Text style={{ color: "#71717a", margin: 0 }}>Flight date: {props.flightDate}</Text>
        <Text style={{ color: "#71717a", margin: 0 }}>Booking ID: {props.bookingId}</Text>
        {props.aircraftRegistration ? (
          <Text style={{ color: "#71717a", margin: 0 }}>Aircraft: {props.aircraftRegistration}</Text>
        ) : null}
        {typeof props.flightTime === "number" ? (
          <Text style={{ color: "#71717a", margin: 0 }}>Flight time: {props.flightTime.toFixed(1)} hours</Text>
        ) : null}
        {props.invoiceNumber ? (
          <Text style={{ color: "#71717a", margin: 0 }}>Invoice: {props.invoiceNumber}</Text>
        ) : null}
        <Text style={{ color: "#18181b", margin: 0 }}>
          Total: {formatMoney(props.invoiceTotal, props.currency)}
        </Text>
      </Section>
      <Button href={props.invoiceUrl} style={{ backgroundColor: "#2563eb", color: "#ffffff", padding: "10px 14px", borderRadius: "6px" }}>
        View Invoice
      </Button>
    </TemplateShell>
  )
}
