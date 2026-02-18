import * as React from "react"
import { redirect } from "next/navigation"

import { InstructorsPageClient } from "@/components/instructors/instructors-page-client"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchInstructors } from "@/lib/instructors/fetch-instructors"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { InstructorWithRelations } from "@/lib/types/instructors"

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

async function InstructorsContent({ tenantId }: { tenantId: string }) {
  const supabase = await createSupabaseServerClient()

  let instructors: InstructorWithRelations[] = []
  let loadError: string | null = null

  try {
    instructors = await fetchInstructors(supabase, tenantId)
  } catch {
    instructors = []
    loadError = "Failed to load instructors. You may not have permission to view this page."
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      <InstructorsPageClient instructors={instructors} />
    </div>
  )
}

export default async function InstructorsPage() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) redirect("/login")

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return (
      <MessageCard
        title="Instructors"
        description="Your account isn&apos;t linked to a tenant yet."
      />
    )
  }

  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <React.Suspense fallback={<ListPageSkeleton />}>
          <InstructorsContent tenantId={tenantId} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
