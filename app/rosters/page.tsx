import * as React from "react"
import { redirect } from "next/navigation"

import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { RostersPageClient } from "@/components/rosters/rosters-page-client"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { fetchRosterPageData } from "@/lib/rosters/fetch-roster-page-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { RosterInstructor, RosterRule, TimelineConfig } from "@/lib/types/roster"

function MessageCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}

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
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

  if (!user) redirect("/login")
  if (!tenantId) {
    return (
      <MessageCard
        title="Rosters"
        description="Your account isn&apos;t linked to a tenant yet."
      />
    )
  }

  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <React.Suspense fallback={<ListPageSkeleton showTabs />}>
          <RostersContent tenantId={tenantId} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
