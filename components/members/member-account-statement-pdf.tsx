import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import type { MemberAccountStatementPdfRow } from "@/lib/account-statement/member-account-statement-pdf-data"

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingRight: 30,
    paddingBottom: 36,
    paddingLeft: 30,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  logoWrap: {
    marginBottom: 10,
  },
  logo: {
    maxWidth: 140,
    maxHeight: 34,
    objectFit: "contain",
  },
  reportLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: "#475569",
    lineHeight: 1.45,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    marginBottom: 2,
  },
  metaItem: {
    width: "33.33%",
    paddingRight: 12,
    marginBottom: 5,
  },
  metaLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  table: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  rowOpening: {
    backgroundColor: "#f8fafc",
  },
  closingRow: {
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
  },
  headerRow: {
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  cell: {
    paddingTop: 3,
    paddingRight: 5,
    paddingBottom: 3,
    paddingLeft: 5,
    justifyContent: "flex-start",
    minHeight: 0,
  },
  cellLast: {
    paddingRight: 4,
  },
  headerCell: {
    paddingTop: 4,
    paddingBottom: 5,
    paddingRight: 5,
    paddingLeft: 5,
  },
  headerText: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  headerTextRight: {
    textAlign: "right",
  },
  cellText: {
    fontSize: 7.5,
    lineHeight: 1.25,
    color: "#1e293b",
  },
  cellDesc: {
    fontSize: 7.5,
    lineHeight: 1.25,
    color: "#475569",
  },
  numericCell: {
    alignItems: "flex-end",
  },
  emptyState: {
    paddingVertical: 16,
    textAlign: "center",
    color: "#64748b",
    fontSize: 8,
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 30,
    right: 30,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    fontSize: 8,
    color: "#94a3b8",
    flexDirection: "row",
    justifyContent: "space-between",
  },
})

const cols = [
  { id: "date" as const, label: "Date", width: "12%" },
  { id: "reference" as const, label: "Reference", width: "16%" },
  { id: "description" as const, label: "Description", width: "37%" },
  { id: "amount" as const, label: "Amount", width: "15%" },
  { id: "balance" as const, label: "Balance", width: "20%" },
]

function amountTextStyle(tone: MemberAccountStatementPdfRow["amountTone"]) {
  const base = { lineHeight: 1.2 as number }
  if (tone === "debit") {
    return { ...base, fontFamily: "Helvetica-Bold", fontSize: 7.75, color: "#b91c1c" as const }
  }
  if (tone === "credit") {
    return { ...base, fontFamily: "Helvetica-Bold", fontSize: 7.75, color: "#15803d" as const }
  }
  return { ...base, fontSize: 7.75, color: "#64748b" as const }
}

function balanceTextStyle(tone: MemberAccountStatementPdfRow["balanceTone"]) {
  const base = { lineHeight: 1.2 as number }
  if (tone === "owing") {
    return { ...base, fontFamily: "Helvetica-Bold", fontSize: 7.75, color: "#b91c1c" as const }
  }
  if (tone === "credit") {
    return { ...base, fontFamily: "Helvetica-Bold", fontSize: 7.75, color: "#15803d" as const }
  }
  return { ...base, fontFamily: "Helvetica-Bold", fontSize: 7.75, color: "#475569" as const }
}

type MemberAccountStatementPdfProps = {
  tenantName: string
  logoUrl?: string | null
  memberName: string
  memberEmail?: string | null
  dateRangeLabel: string
  generatedAtLabel: string
  rows: MemberAccountStatementPdfRow[]
  closingBalanceLabel: string
  closingBalanceTone: MemberAccountStatementPdfRow["balanceTone"]
}

export default function MemberAccountStatementPDF({
  tenantName,
  logoUrl,
  memberName,
  memberEmail,
  dateRangeLabel,
  generatedAtLabel,
  rows,
  closingBalanceLabel,
  closingBalanceTone,
}: MemberAccountStatementPdfProps) {
  return (
    <Document title={`Account Statement - ${memberName}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <View style={styles.header}>
          {logoUrl ? (
            <View style={styles.logoWrap}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop */}
              <Image src={logoUrl} style={styles.logo} />
            </View>
          ) : null}
          <Text style={styles.reportLabel}>{tenantName}</Text>
          <Text style={styles.title}>Account Statement</Text>
          <Text style={styles.subtitle}>Transactions and running balance for the selected period.</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Member</Text>
              <Text style={styles.metaValue}>{memberName}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Period</Text>
              <Text style={styles.metaValue}>{dateRangeLabel}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Generated</Text>
              <Text style={styles.metaValue}>{generatedAtLabel}</Text>
            </View>
            {memberEmail ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Email</Text>
                <Text style={styles.metaValue}>{memberEmail}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            {cols.map((column, index) => (
              <View
                key={column.id}
                style={[
                  styles.cell,
                  styles.headerCell,
                  column.id === "amount" || column.id === "balance" ? styles.numericCell : {},
                  { width: column.width },
                  ...(index === cols.length - 1 ? [styles.cellLast] : []),
                ]}
              >
                <Text
                  style={[styles.headerText, column.id === "amount" || column.id === "balance" ? styles.headerTextRight : {}]}
                >
                  {column.label}
                </Text>
              </View>
            ))}
          </View>

          {rows.length === 0 ? (
            <View style={styles.emptyState}>
              <Text>No transactions found in this period.</Text>
            </View>
          ) : (
            <>
              {rows.map((row) => (
                <View
                  key={row.id}
                  style={[styles.row, row.isOpening ? styles.rowOpening : {}]}
                >
                  <View style={[styles.cell, { width: cols[0].width }]}>
                    <Text style={styles.cellText}>{row.dateLabel}</Text>
                  </View>
                  <View style={[styles.cell, { width: cols[1].width }]}>
                    <Text style={styles.cellText}>
                      {`${row.reference} · ${row.typeLabel}`}
                    </Text>
                  </View>
                  <View style={[styles.cell, { width: cols[2].width }]}>
                    <Text style={styles.cellDesc}>{row.description}</Text>
                  </View>
                  <View style={[styles.cell, styles.numericCell, { width: cols[3].width }]}>
                    <Text style={amountTextStyle(row.amountTone)}>{row.amountLabel}</Text>
                  </View>
                  <View style={[styles.cell, styles.numericCell, styles.cellLast, { width: cols[4].width }]}>
                    <Text style={balanceTextStyle(row.balanceTone)}>{row.balanceLabel}</Text>
                  </View>
                </View>
              ))}

              <View style={styles.closingRow}>
                <View style={[styles.cell, { width: "65%" }]}>
                  <Text style={styles.headerText}>CLOSING BALANCE</Text>
                </View>
                <View style={[styles.cell, styles.numericCell, { width: "15%" }]}>
                  <Text style={amountTextStyle("neutral")}>—</Text>
                </View>
                <View style={[styles.cell, styles.numericCell, styles.cellLast, { width: "20%" }]}>
                  <Text style={balanceTextStyle(closingBalanceTone)}>{closingBalanceLabel}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text>Generated by Flight Desk</Text>
          <Text>
            {rows.length} entr{rows.length === 1 ? "y" : "ies"}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
