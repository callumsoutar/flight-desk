import * as React from "react"
import { redirect } from "next/navigation"

import { BookingsPageClient } from "@/components/bookings/bookings-page-client"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { fetchBookings } from "@/lib/bookings/fetch-bookings"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { BookingWithRelations } from "@/lib/types/bookings"

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

async function BookingsContent({ tenantId }: { tenantId: string }) {
  const supabase = await createSupabaseServerClient()

  let bookings: BookingWithRelations[] = []
  let loadError: string | null = null

  try {
    bookings = await fetchBookings(supabase, tenantId)
  } catch {
    bookings = []
    loadError = "Failed to load bookings. You may not have permission to view this page."
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      <BookingsPageClient bookings={bookings} />
    </div>
  )
}

export default async function BookingsPage() {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

  if (!user) redirect("/login")
  if (!tenantId) {
    return (
      <MessageCard
        title="Bookings"
        description="Your account isn&apos;t linked to a tenant yet."
      />
    )
  }

  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <React.Suspense fallback={<ListPageSkeleton showTabs />}>
          <BookingsContent tenantId={tenantId} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
