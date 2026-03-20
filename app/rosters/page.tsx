import * as React from "react"
import { redirect } from "next/navigation"

import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteLoadingState } from "@/components/loading/route-loading-state"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { RostersPageClient } from "@/components/rosters/rosters-page-client"
import { getAuthSession } from "@/lib/auth/session"
import { fetchRosterPageData } from "@/lib/rosters/fetch-roster-page-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { RosterInstructor, RosterRule, TimelineConfig } from "@/lib/types/roster"

async function RostersContent({ tenantId }: { tenantId: string }) {
  const supabase = await createSupabaseServerClient()

  let instructors: RosterInstructor[] = []
  let rosterRules: RosterRule[] = []
  let timelineConfig: TimelineConfig = {
    startHour: 9,
    endHour: 17,
    intervalMinutes: 30,
  }
  let loadError: string | null = null

  try {
    const data = await fetchRosterPageData(supabase, tenantId)
    instructors = data.instructors
    rosterRules = data.rosterRules
    timelineConfig = data.timelineConfig
  } catch {
    instructors = []
    rosterRules = []
    loadError = "Failed to load roster data. You may not have permission to view this page."
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      <RostersPageClient
        instructors={instructors}
        rosterRules={rosterRules}
        timelineConfig={timelineConfig}
      />
    </div>
  )
}

export default async function RostersPage() {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId, role } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    authoritativeRole: true,
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
  if (!role || !["owner", "admin", "instructor"].includes(role)) redirect("/dashboard")

  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <React.Suspense fallback={<RouteLoadingState message="Loading rosters..." />}>
          <RostersContent tenantId={tenantId} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
