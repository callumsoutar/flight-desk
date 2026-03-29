"use client"

import dynamic from "next/dynamic"

import type { FlyingActivityDashboard } from "@/lib/types/reports"
import type { DateRange, ReportData } from "@/lib/reports/fetch-report-data"

const ReportsDashboard = dynamic(
  () => import("@/components/reports/reports-dashboard").then((mod) => mod.ReportsDashboard),
  { ssr: false }
)

export function ReportsPageClient({
  data,
  dateRange,
  flyingActivity,
}: {
  data: ReportData
  dateRange: DateRange
  flyingActivity: FlyingActivityDashboard | null
}) {
  return <ReportsDashboard data={data} dateRange={dateRange} flyingActivity={flyingActivity} />
}
