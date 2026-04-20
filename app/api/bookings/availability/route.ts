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
  const excludeBookingId = request.nextUrl.searchParams.get("exclude_booking_id")
  if (!startTime || !endTime) {
    return noStoreJson({ error: "start_time and end_time are required" }, { status: 400 })
  }

  const startDate = new Date(startTime)
  const endDate = new Date(endTime)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
    return noStoreJson({ error: "Invalid time range" }, { status: 400 })
  }

  // Basic UUID shape check; tenant scoping in fetchUnavailableResourceIds keeps
  // this safe even if the caller passes a value from another tenant.
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (excludeBookingId && !UUID_REGEX.test(excludeBookingId)) {
    return noStoreJson({ error: "Invalid exclude_booking_id" }, { status: 400 })
  }

  try {
    const { unavailableAircraftIds, unavailableInstructorIds } = await fetchUnavailableResourceIds({
      supabase,
      tenantId,
      startTimeIso: startDate.toISOString(),
      endTimeIso: endDate.toISOString(),
      excludeBookingId: excludeBookingId ?? undefined,
    })

    return noStoreJson({ unavailableAircraftIds, unavailableInstructorIds })
  } catch {
    return noStoreJson({ error: "Failed to check availability" }, { status: 500 })
  }
}
