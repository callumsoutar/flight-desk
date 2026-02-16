import * as React from "react"
import { redirect } from "next/navigation"

import { AircraftTable } from "@/components/aircraft/aircraft-table"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchAircraft } from "@/lib/aircraft/fetch-aircraft"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { AircraftWithType } from "@/lib/types/aircraft"

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
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>Aircraft</CardTitle>
        <CardDescription>Fleet overview for your tenant.</CardDescription>
      </CardHeader>
      <CardContent>
        {loadError ? <div className="mb-4 text-sm text-muted-foreground">{loadError}</div> : null}
        <AircraftTable aircraft={aircraft} />
      </CardContent>
    </Card>
  )
}

export default async function AircraftPage() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) redirect("/login")

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return (
      <MessageCard
        title="Aircraft"
        description="Your account isn&apos;t linked to a tenant yet."
      />
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
