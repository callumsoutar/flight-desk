import * as React from "react"
import { redirect } from "next/navigation"

import { ReportsPageClient } from "@/components/reports/reports-page-client"
import { ReportsPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteShell, AppRouteDetailContainer } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { getAuthSession } from "@/lib/auth/session"
import {
  getAircraftUtilisationDashboard,
  getHoursByFlightType,
  getStaffDashboard,
} from "@/lib/reports/fetch-extended-report-dashboards"
import { getFlyingActivityDashboard } from "@/lib/reports/fetch-flying-activity-dashboard"
import { fetchReportData, resolveDateRange } from "@/lib/reports/fetch-report-data"
import type { DateRangePreset } from "@/lib/reports/fetch-report-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const VALID_PRESETS: DateRangePreset[] = [
  "last30d",
  "last3m",
  "last6m",
  "last12m",
  "thisMonth",
  "thisYear",
  "custom",
]

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function ReportsContent({
  tenantId,
  role,
  searchParams,
}: {
  tenantId: string
  role: string | null
  searchParams: Record<string, string | string[] | undefined>
}) {
  const rawPreset = typeof searchParams.range === "string" ? searchParams.range : "last12m"
  const preset = VALID_PRESETS.includes(rawPreset as DateRangePreset)
    ? (rawPreset as DateRangePreset)
    : "last12m"

  const customFrom = typeof searchParams.from === "string" ? searchParams.from : null
  const customTo = typeof searchParams.to === "string" ? searchParams.to : null

  const dateRange = resolveDateRange(preset, customFrom, customTo)
  const rangeStart = new Date(`${dateRange.startDate}T00:00:00.000Z`)
  const rangeEnd = new Date(`${dateRange.endDate}T23:59:59.999Z`)

  const supabase = await createSupabaseServerClient()

  let data: Awaited<ReturnType<typeof fetchReportData>> | null = null
  let flyingActivity: Awaited<ReturnType<typeof getFlyingActivityDashboard>> | null = null
  let staffDashboard: Awaited<ReturnType<typeof getStaffDashboard>> | null = null
  let aircraftUtilisation: Awaited<ReturnType<typeof getAircraftUtilisationDashboard>> | null = null
  let hoursByFlightType: Awaited<ReturnType<typeof getHoursByFlightType>> = []
  let loadError: string | null = null
  try {
    const [reportResult, flyingResult, staffResult, aircraftResult, hoursByTypeResult] =
      await Promise.allSettled([
        fetchReportData(supabase, tenantId, dateRange),
        getFlyingActivityDashboard(supabase, tenantId, rangeStart, rangeEnd),
        getStaffDashboard(supabase, tenantId, rangeStart, rangeEnd),
        getAircraftUtilisationDashboard(supabase, tenantId, rangeStart, rangeEnd),
        getHoursByFlightType(supabase, tenantId, rangeStart, rangeEnd),
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
  } catch {
    loadError = "Failed to load report data. Please try again."
  }

  if (loadError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-muted-foreground">{loadError}</p>
      </div>
    )
  }

  return (
    <ReportsPageClient
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

  return (
    <AppRouteShell>
      <AppRouteDetailContainer>
        <React.Suspense fallback={<ReportsPageSkeleton />}>
          <ReportsContent tenantId={tenantId} role={role} searchParams={resolvedSearchParams} />
        </React.Suspense>
      </AppRouteDetailContainer>
    </AppRouteShell>
  )
}
