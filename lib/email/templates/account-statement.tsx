import { Button, Heading, Section, Text } from "@react-email/components"
import * as React from "react"

import { TemplateShell } from "./template-shell"

export type AccountStatementEmailProps = {
  tenantName: string
  logoUrl?: string | null
  memberFirstName: string
  memberEmail: string
  statementDate: string
  currency: string
  openingBalance: number
  invoices: Array<{
    invoiceNumber: string
    date: string
    description: string
    amount: number
    paid: number
    balance: number
    status: string
  }>
  totalOutstanding: number
  statementUrl?: string | null
  contactEmail?: string | null
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value)
}

export function AccountStatementEmail(props: AccountStatementEmailProps) {
  return (
    <TemplateShell preview={`Account statement as at ${props.statementDate}`} tenantName={props.tenantName} logoUrl={props.logoUrl}>
      <Heading style={{ color: "#18181b", margin: "0 0 8px" }}>Account statement</Heading>
      <Text style={{ color: "#18181b" }}>Hi {props.memberFirstName}, here is your current statement.</Text>
      <Text style={{ color: "#71717a" }}>Statement date: {props.statementDate}</Text>
      <Text style={{ color: "#71717a" }}>Opening balance: {formatMoney(props.openingBalance, props.currency)}</Text>
      <Section>
        {props.invoices.map((invoice) => (
          <Text key={`${invoice.invoiceNumber}-${invoice.date}`} style={{ color: "#18181b", margin: "2px 0" }}>
            {invoice.invoiceNumber} ({invoice.status}) - {formatMoney(invoice.balance, props.currency)}
          </Text>
        ))}
      </Section>
      <Text style={{ color: "#18181b" }}>
        Total outstanding: {formatMoney(props.totalOutstanding, props.currency)}
      </Text>
      {props.statementUrl ? (
        <Button href={props.statementUrl} style={{ backgroundColor: "#2563eb", color: "#ffffff", padding: "10px 14px", borderRadius: "6px" }}>
          View Portal
        </Button>
      ) : null}
      {props.contactEmail ? <Text style={{ color: "#71717a" }}>Contact: {props.contactEmail}</Text> : null}
    </TemplateShell>
  )
}
