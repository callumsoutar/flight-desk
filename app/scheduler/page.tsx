import * as React from "react"
import { redirect } from "next/navigation"

import { SchedulerPageClient } from "@/components/scheduler/scheduler-page-client"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchSchedulerPageData } from "@/lib/scheduler/fetch-scheduler-page-data"
import { resolveDateKey } from "@/lib/utils/timezone"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { SchedulerPageData } from "@/lib/types/scheduler"

const DEFAULT_SCHEDULER_TIME_ZONE = "Pacific/Auckland"

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
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

function firstQueryValue(value: string | string[] | undefined) {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function normalizeTimeZone(value: string | null | undefined) {
  if (!value) return DEFAULT_SCHEDULER_TIME_ZONE
  try {
    new Intl.DateTimeFormat("en-NZ", { timeZone: value }).format(new Date())
    return value
  } catch {
    return DEFAULT_SCHEDULER_TIME_ZONE
  }
}

async function SchedulerContent({
  tenantId,
  dateYyyyMmDd,
  timeZone,
}: {
  tenantId: string
  dateYyyyMmDd: string
  timeZone: string
}) {
  const supabase = await createSupabaseServerClient()

  let data: SchedulerPageData | null = null
  let loadError: string | null = null

  try {
    data = await fetchSchedulerPageData({
      supabase,
      tenantId,
      dateYyyyMmDd,
      timeZone,
    })
  } catch {
    loadError = "Failed to load scheduler data. You may not have permission to view this page."
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      {data ? <SchedulerPageClient data={data} /> : null}
    </div>
  )
}

export default async function SchedulerPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

  if (!user) redirect("/login")
  if (!tenantId) {
    return (
      <MessageCard
        title="Scheduler"
        description="Your account isn&apos;t linked to a tenant yet."
      />
    )
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .maybeSingle()
  const timeZone = normalizeTimeZone(tenant?.timezone)

  const params = (await searchParams) ?? {}
  const dateYyyyMmDd = resolveDateKey(firstQueryValue(params.date), timeZone)

  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <React.Suspense fallback={<ListPageSkeleton />}>
          <SchedulerContent tenantId={tenantId} dateYyyyMmDd={dateYyyyMmDd} timeZone={timeZone} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
