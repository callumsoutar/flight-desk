import * as React from "react"
import { redirect } from "next/navigation"

import { InstructorsPageClient } from "@/components/instructors/instructors-page-client"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { getAuthSession } from "@/lib/auth/session"
import { fetchInstructors } from "@/lib/instructors/fetch-instructors"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { InstructorWithRelations } from "@/lib/types/instructors"

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
        <React.Suspense fallback={<ListPageSkeleton />}>
          <InstructorsContent tenantId={tenantId} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
