import { Button, Heading, Section, Text } from "@react-email/components"
import * as React from "react"

import { TemplateShell } from "./template-shell"

export type FlightHistorySummaryEmailProps = {
  tenantName: string
  logoUrl?: string | null
  memberFirstName: string
  memberName: string
  dateRangeLabel: string
  totalFlights: number
  totalFlightHoursLabel: string
  avgHoursPerFlightLabel: string
  portalUrl?: string | null
  contactEmail?: string | null
}

export function FlightHistorySummaryEmail(props: FlightHistorySummaryEmailProps) {
  return (
    <TemplateShell
      preview={`Flight history summary for ${props.dateRangeLabel}`}
      tenantName={props.tenantName}
      logoUrl={props.logoUrl}
    >
      <Heading style={{ color: "#18181b", margin: "0 0 8px" }}>Flight history summary</Heading>
      <Text style={{ color: "#18181b", margin: "0 0 12px" }}>
        Hi {props.memberFirstName || "there"}, your flight history summary is attached as a PDF.
      </Text>
      <Text style={{ color: "#3f3f46", margin: "0 0 4px" }}>Member: {props.memberName}</Text>
      <Text style={{ color: "#3f3f46", margin: "0 0 16px" }}>Period: {props.dateRangeLabel}</Text>

      <Section style={{ margin: "0 0 16px" }}>
        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #e4e4e7", padding: "12px", width: "33.33%" }}>
                <Text style={{ color: "#71717a", fontSize: "11px", margin: "0 0 4px" }}>Total flights</Text>
                <Text style={{ color: "#18181b", fontSize: "22px", fontWeight: 700, margin: 0 }}>
                  {props.totalFlights}
                </Text>
              </td>
              <td style={{ border: "1px solid #e4e4e7", padding: "12px", width: "33.33%" }}>
                <Text style={{ color: "#71717a", fontSize: "11px", margin: "0 0 4px" }}>Total hours</Text>
                <Text style={{ color: "#18181b", fontSize: "22px", fontWeight: 700, margin: 0 }}>
                  {props.totalFlightHoursLabel}
                </Text>
              </td>
              <td style={{ border: "1px solid #e4e4e7", padding: "12px", width: "33.33%" }}>
                <Text style={{ color: "#71717a", fontSize: "11px", margin: "0 0 4px" }}>
                  Avg hours / flight
                </Text>
                <Text style={{ color: "#18181b", fontSize: "22px", fontWeight: 700, margin: 0 }}>
                  {props.avgHoursPerFlightLabel}
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {props.portalUrl ? (
        <Button
          href={props.portalUrl}
          style={{
            backgroundColor: "#2563eb",
            color: "#ffffff",
            padding: "10px 14px",
            borderRadius: "6px",
          }}
        >
          Open member profile
        </Button>
      ) : null}

      <Text style={{ color: "#3f3f46", margin: "14px 0 6px" }}>
        If you have any questions, please reply to this email.
      </Text>
      {props.contactEmail ? <Text style={{ color: "#71717a", margin: 0 }}>Contact: {props.contactEmail}</Text> : null}
    </TemplateShell>
  )
}
