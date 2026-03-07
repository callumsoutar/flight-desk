import * as React from "react"
import { redirect } from "next/navigation"

import { ReportsDashboard } from "@/components/reports/reports-dashboard"
import { ReportsPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteShell, AppRouteDetailContainer } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { getAuthSession } from "@/lib/auth/session"
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
  searchParams,
}: {
  tenantId: string
  searchParams: Record<string, string | string[] | undefined>
}) {
  const rawPreset = typeof searchParams.range === "string" ? searchParams.range : "last12m"
  const preset = VALID_PRESETS.includes(rawPreset as DateRangePreset)
    ? (rawPreset as DateRangePreset)
    : "last12m"

  const customFrom = typeof searchParams.from === "string" ? searchParams.from : null
  const customTo = typeof searchParams.to === "string" ? searchParams.to : null

  const dateRange = resolveDateRange(preset, customFrom, customTo)

  const supabase = await createSupabaseServerClient()

  let data: Awaited<ReturnType<typeof fetchReportData>> | null = null
  let loadError: string | null = null
  try {
    data = await fetchReportData(supabase, tenantId, dateRange)
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

  return <ReportsDashboard data={data} dateRange={dateRange} />
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams

  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, {
    includeTenant: true,
  })

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

  return (
    <AppRouteShell>
      <AppRouteDetailContainer>
        <React.Suspense fallback={<ReportsPageSkeleton />}>
          <ReportsContent tenantId={tenantId} searchParams={resolvedSearchParams} />
        </React.Suspense>
      </AppRouteDetailContainer>
    </AppRouteShell>
  )
}
