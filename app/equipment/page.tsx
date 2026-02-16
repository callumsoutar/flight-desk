import * as React from "react"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { EquipmentPageClient } from "@/components/equipment/equipment-page-client"
import { SiteHeader } from "@/components/site-header"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchEquipment } from "@/lib/equipment/fetch-equipment"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { EquipmentWithIssuance } from "@/lib/types/equipment"

function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">{children}</div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function MessageCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <LayoutShell>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </LayoutShell>
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

  let equipment: EquipmentWithIssuance[] = []
  let loadError: string | null = null

  try {
    equipment = await fetchEquipment(supabase, tenantId)
  } catch {
    equipment = []
    loadError = "Failed to load equipment. You may not have permission to view this page."
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-4">
        {loadError ? (
          <div className="text-sm text-muted-foreground">{loadError}</div>
        ) : null}
        <EquipmentPageClient equipment={equipment} />
      </div>
    </LayoutShell>
  )
}
