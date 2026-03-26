import { NextRequest } from "next/server"

import { fetchSchedulerPageData } from "@/lib/scheduler/fetch-scheduler-page-data"
import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { resolveDateKey } from "@/lib/utils/timezone"

const DEFAULT_SCHEDULER_TIME_ZONE = "Pacific/Auckland"

function normalizeTimeZone(value: string | null | undefined) {
  if (!value) return DEFAULT_SCHEDULER_TIME_ZONE
  try {
    new Intl.DateTimeFormat("en-NZ", { timeZone: value }).format(new Date())
    return value
  } catch {
    return DEFAULT_SCHEDULER_TIME_ZONE
  }
}

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .maybeSingle()

  if (tenantError) {
    return noStoreJson({ error: "Failed to load scheduler timezone" }, { status: 500 })
  }

  const timeZone = normalizeTimeZone(tenant?.timezone)
  const dateYyyyMmDd = resolveDateKey(request.nextUrl.searchParams.get("date"), timeZone)

  try {
    const data = await fetchSchedulerPageData({
      supabase,
      tenantId,
      dateYyyyMmDd,
      timeZone,
    })
    return noStoreJson({ data })
  } catch {
    return noStoreJson({ error: "Failed to load scheduler data" }, { status: 500 })
  }
}
