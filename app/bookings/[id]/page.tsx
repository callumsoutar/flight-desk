import * as React from "react"
import { notFound, redirect } from "next/navigation"

import { BookingDetailClient } from "@/components/bookings/booking-detail-client"
import { BookingDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { getBookingOpenPath } from "@/lib/bookings/navigation"
import { fetchBookingPageData } from "@/lib/bookings/fetch-booking-page-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types/roles"

type PageProps = {
  params: Promise<{ id: string }>
}

async function BookingDetailContent({
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
    pageData = await fetchBookingPageData(supabase, tenantId, bookingId, {
      userId,
      role,
    })
  } catch {
    return (
      <AppRouteNarrowDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Booking</CardTitle>
            <CardDescription>Failed to load booking. Please try again.</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteNarrowDetailContainer>
    )
  }

  if (!pageData.booking) {
    notFound()
  }

  if (pageData.booking.status === "flying") redirect(getBookingOpenPath(bookingId, pageData.booking.status))

  return (
    <BookingDetailClient
      bookingId={bookingId}
      booking={pageData.booking}
      options={pageData.options}
      auditLogs={pageData.auditLogs}
      auditLookupMaps={pageData.auditLookupMaps}
      role={role}
    />
  )
}

export default async function BookingDetailPage({ params }: PageProps) {
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
        <BookingDetailContent tenantId={tenantId} bookingId={id} role={role} userId={user.id} />
      </React.Suspense>
    </AppRouteShell>
  )
}
