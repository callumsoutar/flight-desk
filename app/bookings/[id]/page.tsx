import * as React from "react"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { BookingDetailClient } from "@/components/bookings/booking-detail-client"
import { SiteHeader } from "@/components/site-header"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchBookingPageData } from "@/lib/bookings/fetch-booking-page-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ id: string }>
}

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
        <div className="flex flex-1 flex-col">{children}</div>
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
      <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </LayoutShell>
  )
}

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase)

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

  let pageData: Awaited<ReturnType<typeof fetchBookingPageData>>
  try {
    pageData = await fetchBookingPageData(supabase, tenantId, id)
  } catch {
    return (
      <MessageCard
        title="Booking"
        description="Failed to load booking. Please try again."
      />
    )
  }

  if (!pageData.booking) {
    return (
      <MessageCard
        title="Booking Not Found"
        description="This booking does not exist in your tenant."
      />
    )
  }

  return (
    <LayoutShell>
      <BookingDetailClient
        bookingId={id}
        booking={pageData.booking}
        options={pageData.options}
        auditLogs={pageData.auditLogs}
        role={role}
      />
    </LayoutShell>
  )
}

