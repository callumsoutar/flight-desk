import * as React from "react"
import { redirect } from "next/navigation"

import { AircraftTable } from "@/components/aircraft/aircraft-table"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { getAuthSession } from "@/lib/auth/session"
import { fetchAircraft } from "@/lib/aircraft/fetch-aircraft"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { AircraftWithType } from "@/lib/types/aircraft"

async function AircraftContent({ tenantId }: { tenantId: string }) {
  const supabase = await createSupabaseServerClient()

  let aircraft: AircraftWithType[] = []
  let loadError: string | null = null
  try {
    aircraft = await fetchAircraft(supabase, tenantId)
  } catch {
    aircraft = []
    loadError = "Failed to load aircraft."
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      <AircraftTable aircraft={aircraft} />
    </div>
  )
}

export default async function AircraftPage() {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

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
        <React.Suspense fallback={<ListPageSkeleton />}>
          <AircraftContent tenantId={tenantId} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
