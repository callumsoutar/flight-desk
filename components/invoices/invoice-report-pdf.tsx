import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import type {
  InvoiceDocumentData,
  InvoiceDocumentItem,
} from "@/components/invoices/invoice-document-view"
import type { InvoicingSettings } from "@/lib/invoices/invoicing-settings"
import { formatDate } from "@/lib/utils/date-format"

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111827",
    backgroundColor: "#ffffff",
  },

  /* ── Header ───────────────────────────────────────────────── */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 20,
  },
  logo: {
    maxWidth: 140,
    maxHeight: 50,
    marginBottom: 10,
    objectFit: "contain",
  },
  title: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 12,
    letterSpacing: 1,
  },
  schoolName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  schoolInfo: {
    fontSize: 8,
    color: "#6b7280",
    lineHeight: 1.5,
  },
  schoolInfoLine: {
    marginBottom: 1,
  },

  /* ── Invoice meta box ─────────────────────────────────────── */
  invoiceInfoBox: {
    width: 190,
    padding: 14,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  infoRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoLabel: {
    fontSize: 7.5,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },

  /* ── Divider ──────────────────────────────────────────────── */
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 20,
  },

  /* ── From / Bill To ───────────────────────────────────────── */
  addresses: {
    flexDirection: "row",
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  addressBlock: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  addressName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 2,
  },
  addressDetail: {
    fontSize: 8,
    color: "#6b7280",
    lineHeight: 1.5,
  },

  /* ── Table ─────────────────────────────────────────────────── */
  table: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tableRowLast: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  cellDescription: { flex: 2 },
  cellQuantity: { flex: 0.5, textAlign: "right" },
  cellRate: { flex: 1, textAlign: "right" },
  cellAmount: { flex: 1, textAlign: "right" },
  tableCellText: {
    fontSize: 9,
    color: "#374151",
  },
  tableCellBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },

  /* ── Totals ─────────────────────────────────────────────────── */
  totalsContainer: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalsBox: {
    width: 210,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 8.5,
    color: "#6b7280",
  },
  totalValue: {
    fontSize: 8.5,
    color: "#374151",
  },
  totalDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginVertical: 5,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  grandTotalValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  balanceDueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  balanceDueLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  balanceDueValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },

  /* ── Footer ─────────────────────────────────────────────────── */
  footer: {
    marginTop: 40,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 18,
    textAlign: "center",
  },
  footerText: {
    fontSize: 8.5,
    color: "#6b7280",
    marginBottom: 3,
  },
  paymentTerms: {
    fontSize: 7.5,
    color: "#9ca3af",
  },
})

type InvoiceReportPDFProps = {
  invoice: InvoiceDocumentData
  items: InvoiceDocumentItem[]
  settings: InvoicingSettings
  timeZone: string
}

const money = (value: number | null | undefined) => `$${(typeof value === "number" ? value : 0).toFixed(2)}`

export default function InvoiceReportPDF({
  invoice,
  items,
  settings,
  timeZone,
}: InvoiceReportPDFProps) {
  const taxPercent = Math.round((invoice.taxRate ?? 0) * 100)
  const showLogo = settings.includeLogoOnInvoice && !!settings.logoUrl

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {showLogo && (
              <Image src={settings.logoUrl!} alt="School logo" style={styles.logo} />
            )}
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.schoolName}>{settings.schoolName}</Text>
            <View style={styles.schoolInfo}>
              {settings.billingAddress ? <Text style={styles.schoolInfoLine}>{settings.billingAddress}</Text> : null}
              {settings.gstNumber ? <Text style={styles.schoolInfoLine}>GST: {settings.gstNumber}</Text> : null}
              {settings.contactPhone ? <Text style={styles.schoolInfoLine}>{settings.contactPhone}</Text> : null}
              {settings.contactEmail ? <Text style={styles.schoolInfoLine}>{settings.contactEmail}</Text> : null}
            </View>
          </View>

          <View style={styles.invoiceInfoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Invoice No.</Text>
              <Text style={styles.infoValue}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>{formatDate(invoice.issueDate, timeZone, "medium") || "—"}</Text>
            </View>
            <View style={styles.infoRowLast}>
              <Text style={styles.infoLabel}>Due Date</Text>
              <Text style={styles.infoValue}>{formatDate(invoice.dueDate, timeZone, "medium") || "—"}</Text>
            </View>
          </View>
        </View>

        {/* ── From / Bill To ──────────────────────────────────────── */}
        <View style={styles.addresses}>
          <View style={[styles.addressBlock, { paddingRight: 20 }]}>
            <Text style={styles.addressLabel}>From</Text>
            <Text style={styles.addressName}>{settings.schoolName}</Text>
            {settings.billingAddress ? <Text style={styles.addressDetail}>{settings.billingAddress}</Text> : null}
            {settings.gstNumber ? <Text style={styles.addressDetail}>GST: {settings.gstNumber}</Text> : null}
          </View>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>Bill To</Text>
            <Text style={styles.addressName}>{invoice.billToName}</Text>
          </View>
        </View>

        {/* ── Line Items ──────────────────────────────────────────── */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.cellDescription}>
              <Text style={styles.tableHeaderText}>Description</Text>
            </View>
            <View style={styles.cellQuantity}>
              <Text style={styles.tableHeaderText}>Qty</Text>
            </View>
            <View style={styles.cellRate}>
              <Text style={styles.tableHeaderText}>Rate (incl. tax)</Text>
            </View>
            <View style={styles.cellAmount}>
              <Text style={styles.tableHeaderText}>Amount</Text>
            </View>
          </View>

          {items.map((item, index) => (
            <View
              key={item.id}
              style={index === items.length - 1 ? styles.tableRowLast : styles.tableRow}
            >
              <View style={styles.cellDescription}>
                <Text style={styles.tableCellText}>{item.description}</Text>
              </View>
              <View style={styles.cellQuantity}>
                <Text style={styles.tableCellText}>{item.quantity ?? 0}</Text>
              </View>
              <View style={styles.cellRate}>
                <Text style={styles.tableCellText}>{money(item.rate_inclusive ?? item.unit_price)}</Text>
              </View>
              <View style={styles.cellAmount}>
                <Text style={styles.tableCellBold}>{money(item.line_total)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Totals ──────────────────────────────────────────────── */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal (excl. tax)</Text>
              <Text style={styles.totalValue}>{money(invoice.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax{taxPercent > 0 ? ` (${taxPercent}%)` : ""}</Text>
              <Text style={styles.totalValue}>{money(invoice.taxTotal)}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>{money(invoice.totalAmount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Amount Paid</Text>
              <Text style={styles.totalValue}>{money(invoice.totalPaid)}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.balanceDueRow}>
              <Text style={styles.balanceDueLabel}>Balance Due</Text>
              <Text style={styles.balanceDueValue}>{money(invoice.balanceDue)}</Text>
            </View>
          </View>
        </View>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <View style={styles.footer}>
          {settings.invoiceFooter ? <Text style={styles.footerText}>{settings.invoiceFooter}</Text> : null}
          {settings.paymentTerms ? <Text style={styles.paymentTerms}>{settings.paymentTerms}</Text> : null}
        </View>

      </Page>
    </Document>
  )
}
