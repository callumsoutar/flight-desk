"use client"

import { ReportsDashboard } from "@/components/reports/reports-dashboard"
import type { MemberWithBalance } from "@/lib/types/member-balances"
import type {
  AircraftUtilisationDashboard,
  FlyingActivityDashboard,
  HoursByFlightTypeRow,
  StaffDashboard,
} from "@/lib/types/reports"
import type { DateRange, ReportData } from "@/lib/reports/fetch-report-data"

export function ReportsPageClient({
  data,
  dateRange,
  flyingActivity,
  staffDashboard,
  aircraftUtilisation,
  hoursByFlightType,
  initialMemberBalances,
  memberBalancesTimeZone,
  initialTab,
  role,
}: {
  data: ReportData
  dateRange: DateRange
  flyingActivity: FlyingActivityDashboard | null
  staffDashboard: StaffDashboard | null
  aircraftUtilisation: AircraftUtilisationDashboard | null
  hoursByFlightType: HoursByFlightTypeRow[]
  initialMemberBalances: MemberWithBalance[]
  memberBalancesTimeZone: string
  initialTab: "flying-activity" | "member-balances" | "staff" | "aircraft"
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
      initialMemberBalances={initialMemberBalances}
      memberBalancesTimeZone={memberBalancesTimeZone}
      initialTab={initialTab}
      role={role}
    />
  )
}
