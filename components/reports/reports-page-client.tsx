"use client"

import dynamic from "next/dynamic"

import type {
  AircraftUtilisationDashboard,
  FlyingActivityDashboard,
  HoursByFlightTypeRow,
  StaffDashboard,
} from "@/lib/types/reports"
import type { DateRange, ReportData } from "@/lib/reports/fetch-report-data"

const ReportsDashboard = dynamic(
  () => import("@/components/reports/reports-dashboard").then((mod) => mod.ReportsDashboard),
  { ssr: false }
)

export function ReportsPageClient({
  data,
  dateRange,
  flyingActivity,
  staffDashboard,
  aircraftUtilisation,
  hoursByFlightType,
  role,
}: {
  data: ReportData
  dateRange: DateRange
  flyingActivity: FlyingActivityDashboard | null
  staffDashboard: StaffDashboard | null
  aircraftUtilisation: AircraftUtilisationDashboard | null
  hoursByFlightType: HoursByFlightTypeRow[]
  role: string | null
}) {
  return (
    <ReportsDashboard
      data={data}
      dateRange={dateRange}
      flyingActivity={flyingActivity}
      staffDashboard={staffDashboard}
      aircraftUtilisation={aircraftUtilisation}
      hoursByFlightType={hoursByFlightType}
      role={role}
    />
  )
}
