import * as React from "react"
import { redirect } from "next/navigation"

import { BookingDetailClient } from "@/components/bookings/booking-detail-client"
import { BookingDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchBookingPageData } from "@/lib/bookings/fetch-booking-page-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"

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

async function BookingDetailContent({ tenantId, bookingId }: { tenantId: string; bookingId: string }) {
  const supabase = await createSupabaseServerClient()
  const { role } = await getAuthSession(supabase)

  let pageData: Awaited<ReturnType<typeof fetchBookingPageData>>
  try {
    pageData = await fetchBookingPageData(supabase, tenantId, bookingId)
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
    <BookingDetailClient
      bookingId={bookingId}
      booking={pageData.booking}
      options={pageData.options}
      auditLogs={pageData.auditLogs}
      role={role}
    />
  )
}

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) redirect("/login")

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return (
      <MessageCard
        title="Booking"
        description="Your account isn't linked to a tenant yet."
      />
    )
  }

  return (
    <AppRouteShell>
      <React.Suspense fallback={<BookingDetailSkeleton />}>
        <BookingDetailContent tenantId={tenantId} bookingId={id} />
      </React.Suspense>
    </AppRouteShell>
  )
}
