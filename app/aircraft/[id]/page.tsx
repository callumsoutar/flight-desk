import * as React from "react"
import { redirect } from "next/navigation"

import { AircraftDetailClient } from "@/components/aircraft/aircraft-detail-client"
import { AircraftDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchAircraftDetail } from "@/lib/aircraft/fetch-aircraft-detail"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ id: string }>
}

function MessageCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <AppRouteShell>
      <AppRouteNarrowDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteNarrowDetailContainer>
    </AppRouteShell>
  )
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
    return (
      <AppRouteNarrowDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Aircraft Not Found</CardTitle>
            <CardDescription>This aircraft does not exist in your tenant.</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteNarrowDetailContainer>
    )
  }

  return <AircraftDetailClient aircraftId={id} data={detail.data} loadErrors={detail.loadErrors} />
}

export default async function AircraftDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) redirect("/login")

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return (
      <MessageCard
        title="Aircraft"
        description="Your account isn't linked to a tenant yet."
      />
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
