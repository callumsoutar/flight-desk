import * as React from "react"
import { redirect } from "next/navigation"

import { EquipmentDetailClient } from "@/components/equipment/equipment-detail-client"
import { EquipmentDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { fetchEquipmentDetail } from "@/lib/equipment/fetch-equipment-detail"
import { fetchEquipmentIssuanceHistory } from "@/lib/equipment/fetch-equipment-issuance-history"
import { fetchEquipmentIssuanceMembers } from "@/lib/equipment/fetch-equipment-issuance-members"
import { fetchEquipmentUpdatesHistory } from "@/lib/equipment/fetch-equipment-updates-history"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { EquipmentIssuanceMember } from "@/lib/types/equipment"

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

async function EquipmentDetailContent({
  tenantId,
  id,
  canEdit,
  canDelete,
  canIssueEquipment,
}: {
  tenantId: string
  id: string
  canEdit: boolean
  canDelete: boolean
  canIssueEquipment: boolean
}) {
  const supabase = await createSupabaseServerClient()

  let equipment: Awaited<ReturnType<typeof fetchEquipmentDetail>>
  try {
    equipment = await fetchEquipmentDetail(supabase, tenantId, id)
  } catch {
    return (
      <AppRouteNarrowDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Equipment</CardTitle>
            <CardDescription>Failed to load equipment. Please try again.</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteNarrowDetailContainer>
    )
  }

  if (!equipment) {
    return (
      <AppRouteNarrowDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Equipment Not Found</CardTitle>
            <CardDescription>This equipment does not exist in your tenant.</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteNarrowDetailContainer>
    )
  }

  let issuances: Awaited<ReturnType<typeof fetchEquipmentIssuanceHistory>>["issuances"] = []
  let issuanceUserMap: Record<string, string> = {}
  let issuanceError: string | null = null
  let updates: Awaited<ReturnType<typeof fetchEquipmentUpdatesHistory>>["updates"] = []
  let updatesUserMap: Record<string, string> = {}
  let updatesError: string | null = null
  let issueMembers: EquipmentIssuanceMember[] = []

  try {
    const issuanceHistory = await fetchEquipmentIssuanceHistory(supabase, tenantId, id)
    issuances = issuanceHistory.issuances
    issuanceUserMap = issuanceHistory.userMap
  } catch {
    issuances = []
    issuanceUserMap = {}
    issuanceError = "Failed to load issuance history."
  }

  try {
    const updatesHistory = await fetchEquipmentUpdatesHistory(supabase, tenantId, id)
    updates = updatesHistory.updates
    updatesUserMap = updatesHistory.userMap
  } catch {
    updates = []
    updatesUserMap = {}
    updatesError = "Failed to load update history."
  }

  if (canIssueEquipment) {
    try {
      issueMembers = await fetchEquipmentIssuanceMembers(supabase, tenantId)
    } catch {
      issueMembers = []
    }
  }

  return (
    <EquipmentDetailClient
      equipmentId={id}
      equipment={equipment}
      issuances={issuances}
      issuanceUserMap={issuanceUserMap}
      issuanceError={issuanceError}
      updates={updates}
      updatesUserMap={updatesUserMap}
      updatesError={updatesError}
      issueMembers={issueMembers}
      canIssueEquipment={canIssueEquipment}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  )
}

export default async function EquipmentDetailPage({ params }: PageProps) {
  const { id } = await params

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
        description="Your account isn't linked to a tenant yet."
      />
    )
  }

  if (id === "new") {
    return (
      <MessageCard
        title="New Equipment"
        description="Equipment creation is not available on this route yet."
      />
    )
  }

  const canEdit = role === "owner" || role === "admin" || role === "instructor"
  const canIssueEquipment = role === "owner" || role === "admin" || role === "instructor"
  const canDelete = role === "owner" || role === "admin"

  return (
    <AppRouteShell>
      <React.Suspense fallback={<EquipmentDetailSkeleton />}>
        <EquipmentDetailContent
          tenantId={tenantId}
          id={id}
          canEdit={canEdit}
          canDelete={canDelete}
          canIssueEquipment={canIssueEquipment}
        />
      </React.Suspense>
    </AppRouteShell>
  )
}
