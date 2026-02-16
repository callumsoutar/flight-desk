import * as React from "react"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { BookingsPageClient } from "@/components/bookings/bookings-page-client"
import { SiteHeader } from "@/components/site-header"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchBookings } from "@/lib/bookings/fetch-bookings"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { BookingWithRelations } from "@/lib/types/bookings"

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

export default async function BookingsPage() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) redirect("/login")

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return (
      <MessageCard
        title="Bookings"
        description="Your account isn&apos;t linked to a tenant yet."
      />
    )
  }

  let bookings: BookingWithRelations[] = []
  let loadError: string | null = null

  try {
    bookings = await fetchBookings(supabase, tenantId)
  } catch {
    bookings = []
    loadError = "Failed to load bookings. You may not have permission to view this page."
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-4">
        {loadError ? (
          <div className="text-sm text-muted-foreground">{loadError}</div>
        ) : null}
        <BookingsPageClient bookings={bookings} />
      </div>
    </LayoutShell>
  )
}
