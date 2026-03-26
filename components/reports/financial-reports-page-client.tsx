"use client"

import type {
  FinancialDailySummaryReport,
  FinancialReportFilters,
  FinancialReportType,
  FinancialTransactionListRow,
} from "@/lib/reports/fetch-financial-report-data"
import { FinancialReportBuilder } from "@/components/reports/financial-report-builder"

export function FinancialReportsPageClient({
  filters,
  reportType,
  transactionListRows,
  dailySummary,
}: {
  filters: FinancialReportFilters
  reportType: FinancialReportType
  transactionListRows: FinancialTransactionListRow[]
  dailySummary: FinancialDailySummaryReport | null
}) {
  return (
    <FinancialReportBuilder
      filters={filters}
      reportType={reportType}
      transactionListRows={transactionListRows}
      dailySummary={dailySummary}
    />
  )
}
