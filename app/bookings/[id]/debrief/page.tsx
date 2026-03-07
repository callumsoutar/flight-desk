import * as React from "react"
import { notFound, redirect } from "next/navigation"

import { DebriefViewClient } from "@/components/debrief/debrief-view-client"
import { DebriefViewSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { fetchDebriefData } from "@/lib/debrief/fetch-debrief-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ id: string }>
}

async function DebriefContent({
  tenantId,
  bookingId,
}: {
  tenantId: string
  bookingId: string
}) {
  const supabase = await createSupabaseServerClient()

  let data: Awaited<ReturnType<typeof fetchDebriefData>>
  try {
    data = await fetchDebriefData(supabase, tenantId, bookingId)
  } catch {
    return (
      <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Debrief</CardTitle>
              <CardDescription>Failed to load debrief data. Please try again.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  if (!data.booking) {
    notFound()
  }

  return (
    <DebriefViewClient
      bookingId={bookingId}
      booking={data.booking}
      lessonProgress={data.lessonProgress}
      flightExperiences={data.flightExperiences}
    />
  )
}

export default async function DebriefPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, {
    includeTenant: true,
  })

  if (!user) redirect("/login")
  if (!tenantId) {
    return (
      <AppRouteShell>
        <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <RouteNotFoundState
              heading="Account not set up"
              message="Your account hasn't been fully set up yet. Please contact your administrator."
            />
          </div>
        </div>
      </AppRouteShell>
    )
  }

  return (
    <AppRouteShell>
      <React.Suspense fallback={<DebriefViewSkeleton />}>
        <DebriefContent tenantId={tenantId} bookingId={id} />
      </React.Suspense>
    </AppRouteShell>
  )
}
