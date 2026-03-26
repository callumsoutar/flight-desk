import { Button, Heading, Section, Text } from "@react-email/components"
import * as React from "react"

import type { AccountStatementEntry } from "@/lib/types/account-statement"

import { TemplateShell } from "./template-shell"

export type AccountStatementEmailProps = {
  tenantName: string
  logoUrl?: string | null
  memberFirstName: string
  statementDate: string
  statementPeriodLabel: string
  currency: string
  statement: AccountStatementEntry[]
  closingBalance: number
  statementUrl?: string | null
  contactEmail?: string | null
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value)
}

function formatEntryDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Pacific/Auckland",
  }).format(parsed)
}

function getEntryTypeLabel(type: AccountStatementEntry["entry_type"]) {
  switch (type) {
    case "invoice":
      return "Invoice"
    case "payment":
      return "Payment"
    case "credit_note":
      return "Credit"
    case "opening_balance":
      return "Opening"
    default:
      return ""
  }
}

export function AccountStatementEmail(props: AccountStatementEmailProps) {
  return (
    <TemplateShell preview={`Account statement as at ${props.statementDate}`} tenantName={props.tenantName} logoUrl={props.logoUrl}>
      <Heading style={{ color: "#18181b", margin: "0 0 8px" }}>Account statement</Heading>
      <Text style={{ color: "#18181b", margin: "0 0 12px" }}>
        Hi {props.memberFirstName || "there"}, here is your latest account statement.
      </Text>
      <Text style={{ color: "#3f3f46", margin: "0 0 4px" }}>Statement date: {props.statementDate}</Text>
      <Text style={{ color: "#3f3f46", margin: "0 0 16px" }}>Period: {props.statementPeriodLabel}</Text>

      <Section style={{ margin: "0 0 16px" }}>
        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left" style={{ borderBottom: "1px solid #e4e4e7", color: "#71717a", fontSize: "12px", fontWeight: 600, padding: "8px 6px" }}>
                Date
              </th>
              <th align="left" style={{ borderBottom: "1px solid #e4e4e7", color: "#71717a", fontSize: "12px", fontWeight: 600, padding: "8px 6px" }}>
                Reference
              </th>
              <th align="left" style={{ borderBottom: "1px solid #e4e4e7", color: "#71717a", fontSize: "12px", fontWeight: 600, padding: "8px 6px" }}>
                Description
              </th>
              <th align="right" style={{ borderBottom: "1px solid #e4e4e7", color: "#71717a", fontSize: "12px", fontWeight: 600, padding: "8px 6px" }}>
                Amount
              </th>
              <th align="right" style={{ borderBottom: "1px solid #e4e4e7", color: "#71717a", fontSize: "12px", fontWeight: 600, padding: "8px 6px" }}>
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {props.statement.slice(-20).map((entry) => {
              const isOpening = entry.entry_type === "opening_balance"
              const isDebit = entry.amount > 0

              return (
                <tr key={entry.entry_id} style={{ backgroundColor: isOpening ? "#eff6ff" : "transparent" }}>
                  <td style={{ borderBottom: "1px solid #f4f4f5", color: "#18181b", fontSize: "13px", padding: "8px 6px", verticalAlign: "top" }}>
                    {formatEntryDate(entry.date)}
                  </td>
                  <td style={{ borderBottom: "1px solid #f4f4f5", color: "#18181b", fontSize: "13px", padding: "8px 6px", verticalAlign: "top" }}>
                    <div>{entry.reference}</div>
                    <div style={{ color: "#71717a", fontSize: "11px" }}>{getEntryTypeLabel(entry.entry_type)}</div>
                  </td>
                  <td style={{ borderBottom: "1px solid #f4f4f5", color: "#3f3f46", fontSize: "13px", padding: "8px 6px", verticalAlign: "top" }}>
                    {entry.description}
                  </td>
                  <td align="right" style={{ borderBottom: "1px solid #f4f4f5", color: isOpening ? "#71717a" : isDebit ? "#b91c1c" : "#15803d", fontSize: "13px", fontWeight: 600, padding: "8px 6px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                    {isOpening ? "—" : formatMoney(Math.abs(entry.amount), props.currency)}
                  </td>
                  <td align="right" style={{ borderBottom: "1px solid #f4f4f5", color: entry.balance > 0 ? "#b91c1c" : entry.balance < 0 ? "#15803d" : "#334155", fontSize: "13px", fontWeight: 700, padding: "8px 6px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                    {entry.balance < 0
                      ? `${formatMoney(Math.abs(entry.balance), props.currency)} CR`
                      : formatMoney(entry.balance, props.currency)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Section>

      <Text style={{ color: "#18181b", margin: "0 0 16px", fontWeight: 600 }}>
        Closing balance:{" "}
        {props.closingBalance < 0
          ? `${formatMoney(Math.abs(props.closingBalance), props.currency)} CR`
          : formatMoney(props.closingBalance, props.currency)}
      </Text>
      {props.statement.length > 20 ? (
        <Text style={{ color: "#71717a", margin: "0 0 12px", fontSize: "12px" }}>
          Showing the most recent 20 entries in this email. Open the portal to view the full statement.
        </Text>
      ) : null}
      {props.statementUrl ? (
        <Button href={props.statementUrl} style={{ backgroundColor: "#2563eb", color: "#ffffff", padding: "10px 14px", borderRadius: "6px" }}>
          Open statement in portal
        </Button>
      ) : null}
      <Text style={{ color: "#3f3f46", margin: "14px 0 6px" }}>
        If you have any questions, please reply to this email.
      </Text>
      {props.contactEmail ? <Text style={{ color: "#71717a", margin: 0 }}>Contact: {props.contactEmail}</Text> : null}
    </TemplateShell>
  )
}
