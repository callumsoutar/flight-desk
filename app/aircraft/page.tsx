import * as React from "react"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { AircraftTable } from "@/components/aircraft/aircraft-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchAircraft } from "@/lib/aircraft/fetch-aircraft"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { AircraftWithType } from "@/lib/types/aircraft"

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

export default async function AircraftPage() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) redirect("/login")

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return (
      <MessageCard
        title="Aircraft"
        description="Your account isn&apos;t linked to a tenant yet."
      />
    )
  }

  let aircraft: AircraftWithType[] = []
  let loadError: string | null = null
  try {
    aircraft = await fetchAircraft(supabase, tenantId)
  } catch {
    aircraft = []
    loadError = "Failed to load aircraft."
  }

  return (
    <LayoutShell>
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>Aircraft</CardTitle>
          <CardDescription>Fleet overview for your tenant.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <div className="mb-4 text-sm text-muted-foreground">
              {loadError}
            </div>
          ) : null}
          <AircraftTable aircraft={aircraft} />
        </CardContent>
      </Card>
    </LayoutShell>
  )
}
