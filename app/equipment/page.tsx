import * as React from "react"
import { redirect } from "next/navigation"

import { EquipmentPageClient } from "@/components/equipment/equipment-page-client"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { getAuthSession } from "@/lib/auth/session"
import { fetchEquipment } from "@/lib/equipment/fetch-equipment"
import { fetchEquipmentIssuanceMembers } from "@/lib/equipment/fetch-equipment-issuance-members"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { EquipmentIssuanceMember, EquipmentWithIssuance } from "@/lib/types/equipment"

async function EquipmentContent({
  tenantId,
  canIssueEquipment,
}: {
  tenantId: string
  canIssueEquipment: boolean
}) {
  const supabase = await createSupabaseServerClient()

  let equipment: EquipmentWithIssuance[] = []
  let issueMembers: EquipmentIssuanceMember[] = []
  let loadError: string | null = null

  const [equipmentResult, membersResult] = await Promise.allSettled([
    fetchEquipment(supabase, tenantId),
    canIssueEquipment ? fetchEquipmentIssuanceMembers(supabase, tenantId) : Promise.resolve([]),
  ])

  if (equipmentResult.status === "fulfilled") {
    equipment = equipmentResult.value
  } else {
    equipment = []
    loadError = "Failed to load equipment. You may not have permission to view this page."
  }

  if (membersResult.status === "fulfilled") {
    issueMembers = membersResult.value
  } else {
    issueMembers = []
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      <EquipmentPageClient
        equipment={equipment}
        issueMembers={issueMembers}
        canIssueEquipment={canIssueEquipment}
      />
    </div>
  )
}

export default async function EquipmentPage() {
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

  const canIssueEquipment = role === "owner" || role === "admin" || role === "instructor"

  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <React.Suspense fallback={<ListPageSkeleton />}>
          <EquipmentContent tenantId={tenantId} canIssueEquipment={canIssueEquipment} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
