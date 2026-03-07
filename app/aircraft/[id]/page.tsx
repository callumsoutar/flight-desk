import * as React from "react"
import { notFound, redirect } from "next/navigation"

import { AircraftDetailClient } from "@/components/aircraft/aircraft-detail-client"
import { AircraftDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchAircraftDetail } from "@/lib/aircraft/fetch-aircraft-detail"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ id: string }>
}

async function AircraftDetailContent({ tenantId, id }: { tenantId: string; id: string }) {
  const supabase = await createSupabaseServerClient()

  let detail: Awaited<ReturnType<typeof fetchAircraftDetail>>
  try {
    detail = await fetchAircraftDetail(supabase, tenantId, id)
  } catch {
    return (
      <AppRouteNarrowDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Aircraft</CardTitle>
            <CardDescription>Failed to load aircraft. Please try again.</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteNarrowDetailContainer>
    )
  }

  if (!detail.data) {
    notFound()
  }

  return <AircraftDetailClient aircraftId={id} data={detail.data} loadErrors={detail.loadErrors} />
}

export default async function AircraftDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

  if (!user) redirect("/login")
  if (!tenantId) {
    return (
      <AppRouteShell>
        <AppRouteNarrowDetailContainer>
          <RouteNotFoundState
            heading="Account not set up"
            message="Your account hasn't been fully set up yet. Please contact your administrator."
          />
        </AppRouteNarrowDetailContainer>
      </AppRouteShell>
    )
  }

  return (
    <AppRouteShell>
      <React.Suspense fallback={<AircraftDetailSkeleton />}>
        <AircraftDetailContent tenantId={tenantId} id={id} />
      </React.Suspense>
    </AppRouteShell>
  )
}
