import * as React from "react"
import { redirect } from "next/navigation"

import { BookingCheckoutClient } from "@/components/bookings/booking-checkout-client"
import { BookingDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { fetchBookingPageData } from "@/lib/bookings/fetch-booking-page-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types/roles"

type PageProps = {
  params: Promise<{ id: string }>
}

function MessageCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <AppRouteShell>
      <AppRouteNarrowDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteNarrowDetailContainer>
    </AppRouteShell>
  )
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
  try {
    pageData = await fetchBookingPageData(supabase, tenantId, bookingId)
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
    return (
      <AppRouteNarrowDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Booking Not Found</CardTitle>
            <CardDescription>This booking does not exist in your tenant.</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteNarrowDetailContainer>
    )
  }

  return (
    <BookingCheckoutClient
      bookingId={bookingId}
      booking={pageData.booking}
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
      <MessageCard
        title="Booking Checkout"
        description="Your account isn't linked to a tenant yet."
      />
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
