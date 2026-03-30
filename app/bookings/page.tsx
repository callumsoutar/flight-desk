import * as React from "react"
import { redirect } from "next/navigation"

import { BookingsPageClient } from "@/components/bookings/bookings-page-client"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { fetchBookings } from "@/lib/bookings/fetch-bookings"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types/roles"
import type { BookingWithRelations } from "@/lib/types/bookings"

async function BookingsContent({
  tenantId,
  viewer,
}: {
  tenantId: string
  viewer: { userId: string; role: UserRole | null }
}) {
  const supabase = await createSupabaseServerClient()

  let bookings: BookingWithRelations[] = []
  let loadError: string | null = null

  try {
    bookings = await fetchBookings(supabase, tenantId, undefined, viewer)
  } catch {
    bookings = []
    loadError = "Failed to load bookings. You may not have permission to view this page."
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      <BookingsPageClient bookings={bookings} isStaff={isStaffRole(viewer.role)} />
    </div>
  )
}

export default async function BookingsPage() {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId, role } = await getAuthSession(supabase, { includeTenant: true, includeRole: true })

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
    <AppRouteShell>
      <AppRouteListContainer>
        <React.Suspense fallback={<ListPageSkeleton showTabs />}>
          <BookingsContent tenantId={tenantId} viewer={{ userId: user.id, role }} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
