import * as React from "react"
import { redirect } from "next/navigation"

import { DebriefEditClient } from "@/components/debrief/debrief-edit-client"
import { DebriefWriteSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { fetchDebriefEditData } from "@/lib/debrief/fetch-debrief-edit-data"
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
      <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </AppRouteShell>
  )
}

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

async function DebriefWriteContent({
  tenantId,
  bookingId,
}: {
  tenantId: string
  bookingId: string
}) {
  const supabase = await createSupabaseServerClient()

  let data: Awaited<ReturnType<typeof fetchDebriefEditData>>
  try {
    data = await fetchDebriefEditData(supabase, tenantId, bookingId)
  } catch {
    return (
      <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Debrief</CardTitle>
              <CardDescription>Failed to load debrief data. Please try again.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  if (!data.booking) {
    return (
      <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Booking Not Found</CardTitle>
              <CardDescription>This booking does not exist in your tenant.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <DebriefEditClient bookingId={bookingId} booking={data.booking} lessonProgress={data.lessonProgress} />
  )
}

export default async function DebriefWritePage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
  })

  if (!user) redirect("/login")
  if (!tenantId) {
    return <MessageCard title="Debrief" description="Your account isn't linked to a tenant yet." />
  }

  if (!isStaff(role)) {
    return <MessageCard title="Debrief" description="Only staff users can write debrief notes." />
  }

  return (
    <AppRouteShell>
      <React.Suspense fallback={<DebriefWriteSkeleton />}>
        <DebriefWriteContent tenantId={tenantId} bookingId={id} />
      </React.Suspense>
    </AppRouteShell>
  )
}
