import { Heading, Text } from "@react-email/components"
import * as React from "react"

import { TemplateShell } from "./template-shell"

export type InvoiceEmailProps = {
  tenantName: string
  logoUrl?: string | null
  memberFirstName: string
  invoiceNumber: string
  invoiceDate: string
  totalAmount: number
  currency: string
  dueDate?: string | null
  contactEmail?: string | null
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value)
}

export function InvoiceEmail(props: InvoiceEmailProps) {
  return (
    <TemplateShell preview={`Invoice ${props.invoiceNumber} is ready`} tenantName={props.tenantName} logoUrl={props.logoUrl}>
      <Heading style={{ color: "#18181b", margin: "0 0 12px" }}>Invoice {props.invoiceNumber}</Heading>
      <Text style={{ color: "#18181b", margin: "0 0 12px" }}>Hi {props.memberFirstName || "there"},</Text>
      <Text style={{ color: "#3f3f46", margin: "0 0 12px" }}>
        Please find attached your invoice <strong>{props.invoiceNumber}</strong> from {props.tenantName}.
      </Text>
      <Text style={{ color: "#3f3f46", margin: "0 0 6px" }}>
        Invoice date: {props.invoiceDate || "—"}
      </Text>
      {props.dueDate ? (
        <Text style={{ color: "#3f3f46", margin: "0 0 6px" }}>
          Due date: {props.dueDate}
        </Text>
      ) : null}
      <Text style={{ color: "#3f3f46", margin: "0 0 16px" }}>
        Total amount: {formatMoney(props.totalAmount, props.currency)}
      </Text>
      <Text style={{ color: "#3f3f46", margin: "0 0 12px" }}>
        If you have any questions, please reply to this email.
      </Text>
      <Text style={{ color: "#3f3f46", margin: "0 0 4px" }}>
        Kind regards,
      </Text>
      <Text style={{ color: "#18181b", margin: "0 0 16px" }}>{props.tenantName}</Text>
      {props.contactEmail ? <Text style={{ color: "#71717a", margin: 0 }}>Contact: {props.contactEmail}</Text> : null}
    </TemplateShell>
  )
}
