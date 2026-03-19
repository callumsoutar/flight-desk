"use client"

import dynamic from "next/dynamic"

import type { DateRange, ReportData } from "@/lib/reports/fetch-report-data"

const ReportsDashboard = dynamic(
  () => import("@/components/reports/reports-dashboard").then((mod) => mod.ReportsDashboard),
  { ssr: false }
)

export function ReportsPageClient({
  data,
  dateRange,
}: {
  data: ReportData
  dateRange: DateRange
}) {
  return <ReportsDashboard data={data} dateRange={dateRange} />
}
