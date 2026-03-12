import * as React from "react"
import { redirect } from "next/navigation"

import { MembersPageClient } from "@/components/members/members-page-client"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { RoleGuard } from "@/components/auth/role-guard"
import { getAuthSession } from "@/lib/auth/session"
import { fetchMembers } from "@/lib/members/fetch-members"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { MemberWithRelations } from "@/lib/types/members"

async function MembersContent({ tenantId }: { tenantId: string }) {
  const supabase = await createSupabaseServerClient()

  let members: MemberWithRelations[] = []
  let loadError: string | null = null

  try {
    members = await fetchMembers(supabase, tenantId)
  } catch {
    members = []
    loadError = "Failed to load members. You may not have permission to view this page."
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      <MembersPageClient members={members} />
    </div>
  )
}

export default async function MembersPage() {
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
    <RoleGuard allowedRoles={["owner", "admin", "instructor"]}>
      <AppRouteShell>
        <AppRouteListContainer>
          <React.Suspense fallback={<ListPageSkeleton showTabs />}>
            <MembersContent tenantId={tenantId} />
          </React.Suspense>
        </AppRouteListContainer>
      </AppRouteShell>
    </RoleGuard>
  )
}
