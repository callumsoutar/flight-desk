import * as React from "react"
import { notFound, redirect } from "next/navigation"

import { EquipmentDetailClient } from "@/components/equipment/equipment-detail-client"
import { EquipmentDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
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
    notFound()
  }

  let issuances: Awaited<ReturnType<typeof fetchEquipmentIssuanceHistory>>["issuances"] = []
  let issuanceUserMap: Record<string, string> = {}
  let issuanceError: string | null = null
  let updates: Awaited<ReturnType<typeof fetchEquipmentUpdatesHistory>>["updates"] = []
  let updatesUserMap: Record<string, string> = {}
  let updatesError: string | null = null
  let issueMembers: EquipmentIssuanceMember[] = []

  const [issuanceResult, updatesResult, issueMembersResult] = await Promise.allSettled([
    fetchEquipmentIssuanceHistory(supabase, tenantId, id),
    fetchEquipmentUpdatesHistory(supabase, tenantId, id),
    canIssueEquipment ? fetchEquipmentIssuanceMembers(supabase, tenantId) : Promise.resolve([]),
  ])

  if (issuanceResult.status === "fulfilled") {
    issuances = issuanceResult.value.issuances
    issuanceUserMap = issuanceResult.value.userMap
  } else {
    issuances = []
    issuanceUserMap = {}
    issuanceError = "Failed to load issuance history."
  }

  if (updatesResult.status === "fulfilled") {
    updates = updatesResult.value.updates
    updatesUserMap = updatesResult.value.userMap
  } else {
    updates = []
    updatesUserMap = {}
    updatesError = "Failed to load update history."
  }

  if (issueMembersResult.status === "fulfilled") {
    issueMembers = issueMembersResult.value
  } else {
    issueMembers = []
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
      <AppRouteShell>
        <AppRouteNarrowDetailContainer>
          <RouteNotFoundState
            heading="Account not set up"
            message="Your account hasn't been fully set up yet. Please contact your administrator."
          />
        </AppRouteNarrowDetailContainer>
      </AppRouteShell>
    )
  }

  if (id === "new") {
    return (
      <AppRouteShell>
        <AppRouteNarrowDetailContainer>
          <RouteNotFoundState
            heading="Not available"
            message="Equipment creation is not available on this route yet."
            backHref="/equipment"
            backLabel="Back to equipment"
          />
        </AppRouteNarrowDetailContainer>
      </AppRouteShell>
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
