import type { AccountStatementEntry } from "@/lib/types/account-statement"
import { formatDateOnlyLabel } from "@/lib/flight-history/member-flight-history-summary"
import { formatDate } from "@/lib/utils/date-format"

function getEntryTypeLabel(type: AccountStatementEntry["entry_type"]): string {
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

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value)
}

export type MemberAccountStatementPdfRow = {
  id: string
  dateLabel: string
  reference: string
  typeLabel: string
  description: string
  amountLabel: string
  amountTone: "neutral" | "debit" | "credit"
  balanceLabel: string
  balanceTone: "owing" | "credit" | "zero"
  isOpening: boolean
}

export function buildMemberAccountStatementPdfRows(
  statement: AccountStatementEntry[],
  options: { currency: string; timeZone: string }
): MemberAccountStatementPdfRow[] {
  const { currency, timeZone } = options

  return statement.map((entry) => {
    const isOpening = entry.entry_type === "opening_balance"
    const isDebit = entry.amount > 0

    const amountLabel = isOpening ? "—" : formatCurrency(Math.abs(entry.amount), currency)
    const amountTone: MemberAccountStatementPdfRow["amountTone"] = isOpening
      ? "neutral"
      : isDebit
        ? "debit"
        : "credit"

    const balanceTone: MemberAccountStatementPdfRow["balanceTone"] =
      entry.balance < 0 ? "credit" : entry.balance > 0 ? "owing" : "zero"

    const balanceLabel =
      entry.balance < 0
        ? `${formatCurrency(Math.abs(entry.balance), currency)} CR`
        : formatCurrency(entry.balance, currency)

    return {
      id: entry.entry_id,
      dateLabel: formatDate(entry.date, timeZone, "medium") || "—",
      reference: entry.reference,
      typeLabel: getEntryTypeLabel(entry.entry_type),
      description: entry.description,
      amountLabel,
      amountTone,
      balanceLabel,
      balanceTone,
      isOpening,
    }
  })
}

export function buildMemberAccountStatementClosingLabel(closingBalance: number, currency: string) {
  return closingBalance < 0
    ? `${formatCurrency(Math.abs(closingBalance), currency)} CR`
    : formatCurrency(closingBalance, currency)
}

export function buildMemberAccountStatementClosingBalanceTone(
  closingBalance: number
): MemberAccountStatementPdfRow["balanceTone"] {
  if (closingBalance < 0) return "credit"
  if (closingBalance > 0) return "owing"
  return "zero"
}

function sanitizeFilenameSegment(value: string) {
  const trimmed = value.trim().replace(/\s+/g, "-")
  const safe = trimmed.replace(/[^a-zA-Z0-9_-]/g, "")
  return safe || "member"
}

export function buildMemberAccountStatementPdfFilename(
  memberName: string,
  fromDate: string,
  toDate: string
) {
  const safeMemberName = sanitizeFilenameSegment(memberName)
  return `account-statement-${safeMemberName}-${fromDate}-to-${toDate}.pdf`
}

export function buildMemberAccountStatementDateRangeLabel(
  fromDate: string,
  toDate: string,
  timeZone: string
) {
  return `${formatDateOnlyLabel(fromDate, timeZone)} to ${formatDateOnlyLabel(toDate, timeZone)}`
}
