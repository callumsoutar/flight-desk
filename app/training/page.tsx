import * as React from "react"
import { redirect } from "next/navigation"

import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { TrainingPageClient } from "@/components/training/training-page-client"
import { RoleGuard } from "@/components/auth/role-guard"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { fetchTrainingOverview } from "@/lib/training/fetch-training-overview"
import type { UserRole } from "@/lib/types/roles"
import type { TrainingOverviewResponse } from "@/lib/types/training-overview"

const TRAINING_ALLOWED_ROLES: UserRole[] = ["owner", "admin", "instructor"]

async function TrainingContent({
  tenantId,
  userId,
  role,
}: {
  tenantId: string
  userId: string
  role: UserRole
}) {
  const supabase = await createSupabaseServerClient()

  let data: TrainingOverviewResponse = {
    generated_at: new Date().toISOString(),
    syllabi: [],
    rows: [],
  }
  let loadError: string | null = null

  try {
    data = await fetchTrainingOverview(supabase, tenantId, userId, role)
  } catch {
    data = { generated_at: new Date().toISOString(), syllabi: [], rows: [] }
    loadError = "Failed to load training overview."
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      <TrainingPageClient data={data} />
    </div>
  )
}

export default async function TrainingPage() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
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

  if (!role || !TRAINING_ALLOWED_ROLES.includes(role)) redirect("/dashboard")

  return (
    <RoleGuard allowedRoles={TRAINING_ALLOWED_ROLES}>
      <AppRouteShell>
        <AppRouteListContainer>
          <React.Suspense fallback={<ListPageSkeleton />}>
            <TrainingContent tenantId={tenantId} userId={user.id} role={role} />
          </React.Suspense>
        </AppRouteListContainer>
      </AppRouteShell>
    </RoleGuard>
  )
}
