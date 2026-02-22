import * as React from "react"
import { redirect } from "next/navigation"

import { EquipmentPageClient } from "@/components/equipment/equipment-page-client"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { fetchEquipment } from "@/lib/equipment/fetch-equipment"
import { fetchEquipmentIssuanceMembers } from "@/lib/equipment/fetch-equipment-issuance-members"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { EquipmentIssuanceMember, EquipmentWithIssuance } from "@/lib/types/equipment"

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

  try {
    equipment = await fetchEquipment(supabase, tenantId)
  } catch {
    equipment = []
    loadError = "Failed to load equipment. You may not have permission to view this page."
  }

  if (canIssueEquipment) {
    try {
      issueMembers = await fetchEquipmentIssuanceMembers(supabase, tenantId)
    } catch {
      issueMembers = []
    }
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
      <MessageCard
        title="Equipment"
        description="Your account isn&apos;t linked to a tenant yet."
      />
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
