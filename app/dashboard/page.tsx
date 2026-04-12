import * as React from "react"
import { redirect } from "next/navigation"

import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client"
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { fetchDashboardPageData } from "@/lib/dashboard/fetch-dashboard-page-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types/roles"

async function DashboardContent({
  tenantId,
  viewer,
}: {
  tenantId: string
  viewer: { userId: string; role: UserRole | null }
}) {
  const supabase = await createSupabaseServerClient()

  let data: Awaited<ReturnType<typeof fetchDashboardPageData>>["data"] | null = null
  let loadErrors: string[] = []
  let loadFailed = false

  try {
    const result = await fetchDashboardPageData(supabase, tenantId, viewer)
    data = result.data
    loadErrors = result.loadErrors
  } catch {
    loadFailed = true
  }

  if (loadFailed || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Failed to load dashboard data. Please try again.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {loadErrors.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Some dashboard data couldn&apos;t be loaded: {loadErrors.join(", ")}.
        </div>
      ) : null}
      <DashboardPageClient data={data} />
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId, role } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
  })

  if (!user) redirect("/login")
  if (!tenantId) {
    return (
      <AppRouteShell>
        <AppRouteListContainer>
          <RouteNotFoundState
            heading="Account not set up"
            message="Your account hasn't been fully set up yet. Please contact your administrator."
          />
        </AppRouteListContainer>
      </AppRouteShell>
    )
  }

  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <React.Suspense
          fallback={<DashboardPageSkeleton variant={isStaffRole(role) ? "staff" : "member"} />}
        >
          <DashboardContent tenantId={tenantId} viewer={{ userId: user.id, role }} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
