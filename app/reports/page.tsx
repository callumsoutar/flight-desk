import { redirect } from "next/navigation"

import { ReportsPageClient } from "@/components/reports/reports-page-client"
import { AppRouteShell, AppRouteDetailContainer } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { getAuthSession } from "@/lib/auth/session"
import { fetchMembersWithBalanceMetrics } from "@/lib/members/fetch-member-balances"
import {
  getAircraftUtilisationDashboard,
  getHoursByFlightType,
  getStaffDashboard,
} from "@/lib/reports/fetch-extended-report-dashboards"
import { getFlyingActivityDashboard } from "@/lib/reports/fetch-flying-activity-dashboard"
import { fetchReportData, resolveDateRange } from "@/lib/reports/fetch-report-data"
import type { DateRangePreset } from "@/lib/reports/fetch-report-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const DEFAULT_RANGE_PRESET: DateRangePreset = "last30d"

const VALID_PRESETS: DateRangePreset[] = [
  "last30d",
  "last3m",
  "last6m",
  "last12m",
  "thisMonth",
  "thisYear",
  "custom",
]

const VALID_REPORT_TABS = ["flying-activity", "member-balances", "staff", "aircraft"] as const

type ReportsTab = (typeof VALID_REPORT_TABS)[number]

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient()
  const [resolvedSearchParams, session] = await Promise.all([
    searchParams,
    getAuthSession(supabase, {
      includeTenant: true,
      includeRole: true,
      authoritativeRole: true,
    }),
  ])
  const { user, tenantId, role } = session

  if (!user) redirect("/login")
  if (!tenantId) {
    return (
      <AppRouteShell>
        <AppRouteDetailContainer>
          <RouteNotFoundState
            heading="Account not set up"
            message="Your account hasn't been fully set up yet. Please contact your administrator."
          />
        </AppRouteDetailContainer>
      </AppRouteShell>
    )
  }
  if (!role || !["owner", "admin", "instructor"].includes(role)) redirect("/dashboard")

  const rawPreset =
    typeof resolvedSearchParams.range === "string"
      ? resolvedSearchParams.range
      : DEFAULT_RANGE_PRESET
  const rawTab =
    typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : "flying-activity"
  const initialTab: ReportsTab = VALID_REPORT_TABS.includes(rawTab as ReportsTab)
    ? (rawTab as ReportsTab)
    : "flying-activity"
  const preset = VALID_PRESETS.includes(rawPreset as DateRangePreset)
    ? (rawPreset as DateRangePreset)
    : DEFAULT_RANGE_PRESET

  const customFrom =
    typeof resolvedSearchParams.from === "string" ? resolvedSearchParams.from : null
  const customTo = typeof resolvedSearchParams.to === "string" ? resolvedSearchParams.to : null

  const dateRange = resolveDateRange(preset, customFrom, customTo)
  const rangeStart = new Date(`${dateRange.startDate}T00:00:00.000Z`)
  const rangeEnd = new Date(`${dateRange.endDate}T23:59:59.999Z`)

  let data: Awaited<ReturnType<typeof fetchReportData>> | null = null
  let flyingActivity: Awaited<ReturnType<typeof getFlyingActivityDashboard>> | null = null
  let staffDashboard: Awaited<ReturnType<typeof getStaffDashboard>> | null = null
  let aircraftUtilisation: Awaited<ReturnType<typeof getAircraftUtilisationDashboard>> | null = null
  let hoursByFlightType: Awaited<ReturnType<typeof getHoursByFlightType>> = []
  let memberBalances: Awaited<ReturnType<typeof fetchMembersWithBalanceMetrics>>["members"] = []
  let memberBalancesTimeZone = "Pacific/Auckland"
  let loadError: string | null = null
  try {
    const [reportResult, flyingResult, staffResult, aircraftResult, hoursByTypeResult, memberBalancesResult] =
      await Promise.allSettled([
        fetchReportData(supabase, tenantId, dateRange),
        getFlyingActivityDashboard(supabase, tenantId, rangeStart, rangeEnd),
        getStaffDashboard(supabase, tenantId, rangeStart, rangeEnd),
        getAircraftUtilisationDashboard(supabase, tenantId, rangeStart, rangeEnd),
        getHoursByFlightType(supabase, tenantId, rangeStart, rangeEnd),
        fetchMembersWithBalanceMetrics(supabase, tenantId),
      ])

    if (reportResult.status === "rejected") {
      loadError = "Failed to load report data. Please try again."
    } else {
      data = reportResult.value
    }

    if (flyingResult.status === "fulfilled") {
      flyingActivity = flyingResult.value
    }

    if (staffResult.status === "fulfilled") {
      staffDashboard = staffResult.value
    }

    if (aircraftResult.status === "fulfilled") {
      aircraftUtilisation = aircraftResult.value
    }

    if (hoursByTypeResult.status === "fulfilled") {
      hoursByFlightType = hoursByTypeResult.value
    }

    if (memberBalancesResult.status === "fulfilled") {
      memberBalances = memberBalancesResult.value.members
      memberBalancesTimeZone = memberBalancesResult.value.timeZone
    }
  } catch {
    loadError = "Failed to load report data. Please try again."
  }

  return (
    <AppRouteShell>
      <AppRouteDetailContainer>
        {loadError || !data ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground">{loadError}</p>
          </div>
        ) : (
          <ReportsPageClient
            data={data}
            dateRange={dateRange}
            flyingActivity={flyingActivity}
            staffDashboard={staffDashboard}
            aircraftUtilisation={aircraftUtilisation}
            hoursByFlightType={hoursByFlightType}
            initialMemberBalances={memberBalances}
            memberBalancesTimeZone={memberBalancesTimeZone}
            initialTab={initialTab}
            role={role}
          />
        )}
      </AppRouteDetailContainer>
    </AppRouteShell>
  )
}
