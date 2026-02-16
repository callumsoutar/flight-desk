import * as React from "react"
import { redirect } from "next/navigation"

import { EquipmentPageClient } from "@/components/equipment/equipment-page-client"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchEquipment } from "@/lib/equipment/fetch-equipment"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { EquipmentWithIssuance } from "@/lib/types/equipment"

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

async function EquipmentContent({ tenantId }: { tenantId: string }) {
  const supabase = await createSupabaseServerClient()

  let equipment: EquipmentWithIssuance[] = []
  let loadError: string | null = null

  try {
    equipment = await fetchEquipment(supabase, tenantId)
  } catch {
    equipment = []
    loadError = "Failed to load equipment. You may not have permission to view this page."
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      <EquipmentPageClient equipment={equipment} />
    </div>
  )
}

export default async function EquipmentPage() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) redirect("/login")

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return (
      <MessageCard
        title="Equipment"
        description="Your account isn&apos;t linked to a tenant yet."
      />
    )
  }

  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <React.Suspense fallback={<ListPageSkeleton />}>
          <EquipmentContent tenantId={tenantId} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
