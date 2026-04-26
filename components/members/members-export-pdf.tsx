import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import type { MemberExportRow } from "@/lib/members/member-exports"

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 28,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  meta: {
    fontSize: 9,
    color: "#475569",
  },
  table: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  rowLast: {
    flexDirection: "row",
  },
  headerRow: {
    backgroundColor: "#f8fafc",
  },
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  cellLast: {
    borderRightWidth: 0,
  },
  headerText: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    textTransform: "uppercase",
  },
  cellText: {
    fontSize: 7.5,
    color: "#0f172a",
  },
})

const columns = [
  { key: "MembershipNumber", label: "Membership #", width: "9%" },
  { key: "FirstName", label: "First name", width: "10%" },
  { key: "Surname", label: "Surname", width: "10%" },
  { key: "CompanyName", label: "Company", width: "12%" },
  { key: "PhoneHome", label: "Phone home", width: "8%" },
  { key: "PhoneWork", label: "Phone work", width: "8%" },
  { key: "PhoneMobile", label: "Phone mobile", width: "10%" },
  { key: "Fax", label: "Fax", width: "5%" },
  { key: "Email", label: "Email", width: "15%" },
  { key: "MembershipType", label: "Membership type", width: "8%" },
  { key: "MembershipStatus", label: "Membership status", width: "5%" },
] as const satisfies ReadonlyArray<{
  key: keyof MemberExportRow
  label: string
  width: string
}>

type MembersExportPDFProps = {
  rows: MemberExportRow[]
  generatedAt: string
}

export function MembersExportPDF({ rows, generatedAt }: MembersExportPDFProps) {
  return (
    <Document title="Members export">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Members Export</Text>
          <Text style={styles.meta}>
            Generated {generatedAt} · {rows.length} member{rows.length === 1 ? "" : "s"}
          </Text>
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

          {rows.map((row, rowIndex) => (
            <View
              key={`${row.Email}-${rowIndex}`}
              style={rowIndex === rows.length - 1 ? styles.rowLast : styles.row}
            >
              {columns.map((column, columnIndex) => (
                <View
                  key={column.key}
                  style={[
                    styles.cell,
                    { width: column.width },
                    ...(columnIndex === columns.length - 1 ? [styles.cellLast] : []),
                  ]}
                >
                  <Text style={styles.cellText}>{row[column.key] || " "}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
