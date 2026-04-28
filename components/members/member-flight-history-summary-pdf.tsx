import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import type { MemberFlightHistorySummaryRow } from "@/lib/flight-history/member-flight-history-summary"

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
    marginTop: 12,
    marginBottom: 12,
  },
  metaItem: {
    width: "33.33%",
    paddingRight: 12,
    marginBottom: 8,
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
  statsRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    marginRight: 10,
    paddingTop: 10,
    paddingRight: 12,
    paddingBottom: 10,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    backgroundColor: "#f8fafc",
  },
  statCardLast: {
    marginRight: 0,
  },
  statLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  table: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  rowLast: {
    flexDirection: "row",
  },
  headerRow: {
    backgroundColor: "#f8fafc",
  },
  cell: {
    paddingTop: 8,
    paddingRight: 8,
    paddingBottom: 8,
    paddingLeft: 8,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#f1f5f9",
  },
  cellLast: {
    borderRightWidth: 0,
  },
  headerText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  cellText: {
    fontSize: 8.5,
    color: "#0f172a",
  },
  cellTextMuted: {
    fontSize: 8.5,
    color: "#475569",
  },
  emptyState: {
    paddingTop: 20,
    paddingBottom: 20,
    textAlign: "center",
    color: "#64748b",
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

type MemberFlightHistorySummaryPdfProps = {
  tenantName: string
  logoUrl?: string | null
  memberName: string
  memberEmail?: string | null
  dateRangeLabel: string
  generatedAtLabel: string
  totalFlights: number
  totalFlightHoursLabel: string
  avgHoursPerFlightLabel: string
  rows: MemberFlightHistorySummaryRow[]
}

const columns = [
  { key: "dateLabel", label: "Date", width: "14%" },
  { key: "aircraftLabel", label: "Aircraft", width: "18%" },
  { key: "instructorLabel", label: "Instructor", width: "18%" },
  { key: "description", label: "Description", width: "36%" },
  { key: "flightTimeLabel", label: "Flight Time", width: "14%" },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<
    MemberFlightHistorySummaryRow,
    "dateLabel" | "aircraftLabel" | "instructorLabel" | "description" | "flightTimeLabel"
  >
  label: string
  width: string
}>

export default function MemberFlightHistorySummaryPDF({
  tenantName,
  logoUrl,
  memberName,
  memberEmail,
  dateRangeLabel,
  generatedAtLabel,
  totalFlights,
  totalFlightHoursLabel,
  avgHoursPerFlightLabel,
  rows,
}: MemberFlightHistorySummaryPdfProps) {
  return (
    <Document title={`Flight History Summary - ${memberName}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <View style={styles.header}>
          {logoUrl ? (
            <View style={styles.logoWrap}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop */}
              <Image src={logoUrl} style={styles.logo} />
            </View>
          ) : null}
          <Text style={styles.reportLabel}>{tenantName}</Text>
          <Text style={styles.title}>Flight History Summary</Text>
          <Text style={styles.subtitle}>
            A summary of completed flights for the selected reporting period.
          </Text>

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

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Flights</Text>
            <Text style={styles.statValue}>{totalFlights}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Hours</Text>
            <Text style={styles.statValue}>{totalFlightHoursLabel}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardLast]}>
            <Text style={styles.statLabel}>Avg Hours / Flight</Text>
            <Text style={styles.statValue}>{avgHoursPerFlightLabel}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            {columns.map((column, index) => (
              <View
                key={column.key}
                style={[
                  styles.cell,
                  { width: column.width },
                  ...(index === columns.length - 1 ? [styles.cellLast] : []),
                ]}
              >
                <Text style={styles.headerText}>{column.label}</Text>
              </View>
            ))}
          </View>

          {rows.length === 0 ? (
            <View style={styles.emptyState}>
              <Text>No completed flights found in this date range.</Text>
            </View>
          ) : (
            rows.map((row, rowIndex) => (
              <View key={row.id} style={rowIndex === rows.length - 1 ? styles.rowLast : styles.row}>
                <View style={[styles.cell, { width: columns[0].width }]}>
                  <Text style={styles.cellText}>{row.dateLabel}</Text>
                </View>
                <View style={[styles.cell, { width: columns[1].width }]}>
                  <Text style={styles.cellText}>{row.aircraftLabel}</Text>
                </View>
                <View style={[styles.cell, { width: columns[2].width }]}>
                  <Text style={row.isSolo ? styles.cellText : styles.cellTextMuted}>
                    {row.instructorLabel}
                  </Text>
                </View>
                <View style={[styles.cell, { width: columns[3].width }]}>
                  <Text style={styles.cellTextMuted}>{row.description}</Text>
                </View>
                <View style={[styles.cell, { width: columns[4].width }, styles.cellLast]}>
                  <Text style={styles.cellText}>{row.flightTimeLabel}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.footer}>
          <Text>Generated by Flight Desk</Text>
          <Text>{rows.length} row{rows.length === 1 ? "" : "s"}</Text>
        </View>
      </Page>
    </Document>
  )
}
