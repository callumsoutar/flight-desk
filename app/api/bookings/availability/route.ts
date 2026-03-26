import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchUnavailableResourceIds } from "@/lib/bookings/resource-availability"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const startTime = request.nextUrl.searchParams.get("start_time")
  const endTime = request.nextUrl.searchParams.get("end_time")
  if (!startTime || !endTime) {
    return noStoreJson({ error: "start_time and end_time are required" }, { status: 400 })
  }

  const startDate = new Date(startTime)
  const endDate = new Date(endTime)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
    return noStoreJson({ error: "Invalid time range" }, { status: 400 })
  }

  try {
    const { unavailableAircraftIds, unavailableInstructorIds } = await fetchUnavailableResourceIds({
      supabase,
      tenantId,
      startTimeIso: startDate.toISOString(),
      endTimeIso: endDate.toISOString(),
    })

    return noStoreJson({ unavailableAircraftIds, unavailableInstructorIds })
  } catch {
    return noStoreJson({ error: "Failed to check availability" }, { status: 500 })
  }
}
