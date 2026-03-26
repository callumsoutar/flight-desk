import { redirect } from "next/navigation"

import { AppRouteDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { FinancialReportsPageClient } from "@/components/reports/financial-reports-page-client"
import { getAuthSession } from "@/lib/auth/session"
import {
  fetchFinancialDailySummaryReport,
  fetchFinancialTransactionListReport,
  getDefaultFinancialReportFilters,
  normalizeFinancialReportFilters,
  type FinancialReportType,
} from "@/lib/reports/fetch-financial-report-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const VALID_REPORT_TYPES: FinancialReportType[] = ["transaction_list", "daily_summary"]

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getSingleValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value) && value.length > 0) return value[0] ?? null
  return null
}

export default async function FinancialReportsPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient()
  const [resolvedSearchParams, session] = await Promise.all([
    searchParams,
    getAuthSession(supabase, {
      includeRole: true,
      includeTenant: true,
      authoritativeRole: true,
      authoritativeTenant: true,
    }),
  ])
  const { user, role, tenantId } = session

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

  if (!role || !["owner", "admin"].includes(role)) redirect("/reports")

  const rawType = getSingleValue(resolvedSearchParams.type)
  const reportType = VALID_REPORT_TYPES.includes(rawType as FinancialReportType)
    ? (rawType as FinancialReportType)
    : "transaction_list"

  const rawStart = getSingleValue(resolvedSearchParams.start)
  const rawEnd = getSingleValue(resolvedSearchParams.end)
  const fallbackFilters = getDefaultFinancialReportFilters()
  let filters = normalizeFinancialReportFilters(
    fallbackFilters.startDateTimeUtc,
    fallbackFilters.endDateTimeUtc
  )
  if (rawStart && rawEnd) {
    try {
      filters = normalizeFinancialReportFilters(rawStart, rawEnd)
    } catch {
      filters = normalizeFinancialReportFilters(
        fallbackFilters.startDateTimeUtc,
        fallbackFilters.endDateTimeUtc
      )
    }
  }

  let transactionListRows = [] as Awaited<
    ReturnType<typeof fetchFinancialTransactionListReport>
  >
  let dailySummary = null as Awaited<ReturnType<typeof fetchFinancialDailySummaryReport>> | null
  let loadError: string | null = null

  if (reportType === "transaction_list") {
    try {
      transactionListRows = await fetchFinancialTransactionListReport(supabase, filters)
    } catch {
      loadError = "Failed to load financial report data. Please try again."
    }
  } else {
    try {
      dailySummary = await fetchFinancialDailySummaryReport(supabase, filters)
    } catch {
      loadError = "Failed to load financial report data. Please try again."
    }
  }

  return (
    <AppRouteShell>
      <AppRouteDetailContainer>
        {loadError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground">{loadError}</p>
          </div>
        ) : (
          <FinancialReportsPageClient
            filters={filters}
            reportType={reportType}
            transactionListRows={transactionListRows}
            dailySummary={dailySummary}
          />
        )}
      </AppRouteDetailContainer>
    </AppRouteShell>
  )
}
