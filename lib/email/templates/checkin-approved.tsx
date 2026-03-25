import { Button, Heading, Section, Text } from "@react-email/components"
import * as React from "react"

import { TemplateShell } from "@/lib/email/templates/template-shell"

export type CheckinApprovedEmailProps = {
  tenantName: string
  logoUrl?: string | null
  memberFirstName: string
  bookingId: string
  flightDate: string
  aircraftRegistration?: string | null
  invoiceNumber?: string | null
  invoiceTotal?: number | null
  currency?: string | null
  invoiceUrl: string
  dueDate?: string | null
}

function formatMoney(amount: number | null | undefined, currency: string) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null

  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function CheckinApprovedEmail({
  tenantName,
  logoUrl,
  memberFirstName,
  bookingId,
  flightDate,
  aircraftRegistration,
  invoiceNumber,
  invoiceTotal,
  currency,
  invoiceUrl,
  dueDate,
}: CheckinApprovedEmailProps) {
  const safeFirstName = memberFirstName.trim() || "there"
  const total = formatMoney(invoiceTotal, currency ?? "NZD")

  return (
    <TemplateShell
      preview={`Flight complete${invoiceNumber ? ` - invoice ${invoiceNumber}` : ""}`}
      tenantName={tenantName}
      logoUrl={logoUrl}
    >
      <Heading style={styles.heading}>Flight complete</Heading>
      <Text style={styles.body}>
        Hi {safeFirstName}, your booking on {flightDate} has been checked off and your invoice is ready.
      </Text>
      <Section style={styles.panel}>
        <Text style={styles.label}>Booking</Text>
        <Text style={styles.value}>{bookingId}</Text>
        {aircraftRegistration ? (
          <>
            <Text style={styles.label}>Aircraft</Text>
            <Text style={styles.value}>{aircraftRegistration}</Text>
          </>
        ) : null}
        {invoiceNumber ? (
          <>
            <Text style={styles.label}>Invoice</Text>
            <Text style={styles.value}>{invoiceNumber}</Text>
          </>
        ) : null}
        {total ? (
          <>
            <Text style={styles.label}>Total</Text>
            <Text style={styles.value}>{total}</Text>
          </>
        ) : null}
        {dueDate ? (
          <>
            <Text style={styles.label}>Due date</Text>
            <Text style={styles.value}>{dueDate}</Text>
          </>
        ) : null}
      </Section>
      <Section style={styles.buttonWrap}>
        <Button href={invoiceUrl} style={styles.button}>
          View invoice
        </Button>
      </Section>
    </TemplateShell>
  )
}

const styles = {
  heading: {
    fontSize: "24px",
    lineHeight: "32px",
    margin: "0 0 12px",
  },
  body: {
    fontSize: "15px",
    lineHeight: "24px",
    color: "#27272a",
    margin: "0 0 20px",
  },
  panel: {
    backgroundColor: "#f4f4f5",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "20px",
  },
  label: {
    fontSize: "12px",
    color: "#71717a",
    margin: "0 0 4px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  },
  value: {
    fontSize: "15px",
    color: "#18181b",
    margin: "0 0 12px",
  },
  buttonWrap: {
    marginTop: "8px",
  },
  button: {
    backgroundColor: "#18181b",
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: "600",
    padding: "12px 18px",
    textDecoration: "none",
  },
}
