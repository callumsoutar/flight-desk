import * as React from "react"
import { notFound, redirect } from "next/navigation"

import { InstructorDetailClient } from "@/components/instructors/instructor-detail-client"
import { InstructorDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { fetchInstructorCategories } from "@/lib/instructors/fetch-instructor-categories"
import { fetchInstructorDetail } from "@/lib/instructors/fetch-instructor-detail"
import { fetchInstructorRateMetadata } from "@/lib/instructors/fetch-instructor-rate-metadata"
import { fetchInstructorRates } from "@/lib/instructors/fetch-instructor-rates"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ id: string }>
}

async function InstructorDetailContent({
  tenantId,
  userId,
  canDeleteInstructor,
}: {
  tenantId: string
  userId: string
  canDeleteInstructor: boolean
}) {
  const supabase = await createSupabaseServerClient()

  let instructor: Awaited<ReturnType<typeof fetchInstructorDetail>>
  try {
    instructor = await fetchInstructorDetail(supabase, tenantId, userId)
  } catch {
    return (
      <AppRouteDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Instructor</CardTitle>
            <CardDescription>Failed to load instructor. Please try again.</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteDetailContainer>
    )
  }

  if (!instructor) {
    notFound()
  }

  let rates: Awaited<ReturnType<typeof fetchInstructorRates>> = []
  let instructorCategories: Awaited<ReturnType<typeof fetchInstructorCategories>> = []
  let flightTypes: Awaited<ReturnType<typeof fetchInstructorRateMetadata>>["flightTypes"] = []
  let defaultTaxRate: Awaited<ReturnType<typeof fetchInstructorRateMetadata>>["defaultTaxRate"] = null
  let loadError: string | null = null

  const [ratesResult, categoriesResult, metadataResult] = await Promise.allSettled([
    fetchInstructorRates(supabase, tenantId, instructor.id),
    fetchInstructorCategories(supabase),
    fetchInstructorRateMetadata(supabase, tenantId),
  ])

  if (ratesResult.status === "fulfilled") rates = ratesResult.value
  if (categoriesResult.status === "fulfilled") instructorCategories = categoriesResult.value
  if (metadataResult.status === "fulfilled") {
    flightTypes = metadataResult.value.flightTypes
    defaultTaxRate = metadataResult.value.defaultTaxRate
  }

  if (
    ratesResult.status === "rejected" ||
    categoriesResult.status === "rejected" ||
    metadataResult.status === "rejected"
  ) {
    loadError = "Some instructor sections could not be loaded."
  }

  return (
    <AppRouteDetailContainer>
      <div className="flex flex-col gap-4">
        {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
        <InstructorDetailClient
          instructor={instructor}
          instructorCategories={instructorCategories}
          rates={rates}
          flightTypes={flightTypes}
          defaultTaxRate={defaultTaxRate}
          canDeleteInstructor={canDeleteInstructor}
        />
      </div>
    </AppRouteDetailContainer>
  )
}

export default async function InstructorDetailPage({ params }: PageProps) {
  const { id } = await params

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
        <AppRouteDetailContainer>
          <RouteNotFoundState
            heading="Account not set up"
            message="Your account hasn't been fully set up yet. Please contact your administrator."
          />
        </AppRouteDetailContainer>
      </AppRouteShell>
    )
  }
  if (!isAdminRole(role)) redirect("/dashboard")

  return (
    <AppRouteShell>
      <React.Suspense
        fallback={
          <AppRouteDetailContainer>
            <InstructorDetailSkeleton />
          </AppRouteDetailContainer>
        }
      >
        <InstructorDetailContent
          tenantId={tenantId}
          userId={id}
          canDeleteInstructor={isAdminRole(role)}
        />
      </React.Suspense>
    </AppRouteShell>
  )
}
