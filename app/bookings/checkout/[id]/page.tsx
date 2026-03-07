import * as React from "react"
import { notFound, redirect } from "next/navigation"

import { BookingCheckoutClient } from "@/components/bookings/booking-checkout-client"
import { BookingDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { fetchBookingCheckoutWarnings } from "@/lib/bookings/fetch-booking-checkout-warnings"
import { fetchBookingPageData } from "@/lib/bookings/fetch-booking-page-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types/roles"

type PageProps = {
  params: Promise<{ id: string }>
}

async function BookingCheckoutContent({
  tenantId,
  bookingId,
  role,
}: {
  tenantId: string
  bookingId: string
  role: UserRole | null
}) {
  const supabase = await createSupabaseServerClient()

  let pageData: Awaited<ReturnType<typeof fetchBookingPageData>>
  let initialWarnings: Awaited<ReturnType<typeof fetchBookingCheckoutWarnings>>
  try {
    const [resolvedPageData, resolvedWarnings] = await Promise.all([
      fetchBookingPageData(supabase, tenantId, bookingId),
      fetchBookingCheckoutWarnings(supabase, tenantId, { bookingId }),
    ])
    pageData = resolvedPageData
    initialWarnings = resolvedWarnings
  } catch {
    return (
      <AppRouteNarrowDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Booking Checkout</CardTitle>
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
    <BookingCheckoutClient
      bookingId={bookingId}
      booking={pageData.booking}
      initialWarnings={initialWarnings}
      options={pageData.options}
      role={role}
    />
  )
}

export default async function BookingCheckoutPage({ params }: PageProps) {
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
        <BookingCheckoutContent tenantId={tenantId} bookingId={id} role={role} />
      </React.Suspense>
    </AppRouteShell>
  )
}
