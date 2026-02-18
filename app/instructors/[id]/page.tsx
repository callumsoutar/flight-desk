import * as React from "react"
import { redirect } from "next/navigation"

import { InstructorDetailClient } from "@/components/instructors/instructor-detail-client"
import { InstructorDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchInstructorCategories } from "@/lib/instructors/fetch-instructor-categories"
import { fetchInstructorDetail } from "@/lib/instructors/fetch-instructor-detail"
import { fetchInstructorRateMetadata } from "@/lib/instructors/fetch-instructor-rate-metadata"
import { fetchInstructorRates } from "@/lib/instructors/fetch-instructor-rates"
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
      <AppRouteDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteDetailContainer>
    </AppRouteShell>
  )
}

async function InstructorDetailContent({
  tenantId,
  userId,
}: {
  tenantId: string
  userId: string
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
    return (
      <AppRouteDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Instructor Not Found</CardTitle>
            <CardDescription>This instructor does not exist in your tenant.</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteDetailContainer>
    )
  }

  let rates: Awaited<ReturnType<typeof fetchInstructorRates>> = []
  let instructorCategories: Awaited<ReturnType<typeof fetchInstructorCategories>> = []
  let flightTypes: Awaited<ReturnType<typeof fetchInstructorRateMetadata>>["flightTypes"] = []
  let defaultTaxRate: Awaited<ReturnType<typeof fetchInstructorRateMetadata>>["defaultTaxRate"] = null
  let loadError: string | null = null

  try {
    const [rateRows, categories, rateMetadata] = await Promise.all([
      fetchInstructorRates(supabase, tenantId, instructor.id),
      fetchInstructorCategories(supabase),
      fetchInstructorRateMetadata(supabase, tenantId),
    ])
    rates = rateRows
    instructorCategories = categories
    flightTypes = rateMetadata.flightTypes
    defaultTaxRate = rateMetadata.defaultTaxRate
  } catch {
    rates = []
    instructorCategories = []
    flightTypes = []
    defaultTaxRate = null
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
        />
      </div>
    </AppRouteDetailContainer>
  )
}

export default async function InstructorDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) redirect("/login")

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return (
      <MessageCard
        title="Instructor"
        description="Your account isn&apos;t linked to a tenant yet."
      />
    )
  }

  return (
    <AppRouteShell>
      <React.Suspense
        fallback={
          <AppRouteDetailContainer>
            <InstructorDetailSkeleton />
          </AppRouteDetailContainer>
        }
      >
        <InstructorDetailContent tenantId={tenantId} userId={id} />
      </React.Suspense>
    </AppRouteShell>
  )
}
