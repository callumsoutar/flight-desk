import * as React from "react"
import { notFound, redirect } from "next/navigation"

import { BookingCheckinClient } from "@/components/bookings/booking-checkin-client"
import { BookingDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { fetchBookingPageData } from "@/lib/bookings/fetch-booking-page-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types/roles"

type PageProps = {
  params: Promise<{ id: string }>
}

async function BookingCheckinContent({
  tenantId,
  bookingId,
  role,
  userId,
}: {
  tenantId: string
  bookingId: string
  role: UserRole | null
  userId: string
}) {
  const supabase = await createSupabaseServerClient()

  let pageData: Awaited<ReturnType<typeof fetchBookingPageData>>
  try {
    pageData = await fetchBookingPageData(supabase, tenantId, bookingId, { userId, role })
  } catch {
    return (
      <AppRouteNarrowDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Flight Check-In</CardTitle>
            <CardDescription>Failed to load booking. Please try again.</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteNarrowDetailContainer>
    )
  }

  if (!pageData.booking) {
    notFound()
  }

  return (
    <BookingCheckinClient
      bookingId={bookingId}
      booking={pageData.booking}
      options={pageData.options}
      role={role}
    />
  )
}

export default async function BookingCheckinPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
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

  return (
    <AppRouteShell>
      <React.Suspense fallback={<BookingDetailSkeleton />}>
        <BookingCheckinContent tenantId={tenantId} bookingId={id} role={role} userId={user.id} />
      </React.Suspense>
    </AppRouteShell>
  )
}
