import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchUnavailableResourceIds } from "@/lib/bookings/resource-availability"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const startTime = request.nextUrl.searchParams.get("start_time")
  const endTime = request.nextUrl.searchParams.get("end_time")
  if (!startTime || !endTime) {
    return NextResponse.json(
      { error: "start_time and end_time are required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const startDate = new Date(startTime)
  const endDate = new Date(endTime)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
    return NextResponse.json(
      { error: "Invalid time range" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const { unavailableAircraftIds, unavailableInstructorIds } = await fetchUnavailableResourceIds({
      supabase,
      tenantId,
      startTimeIso: startDate.toISOString(),
      endTimeIso: endDate.toISOString(),
    })

    return NextResponse.json(
      { unavailableAircraftIds, unavailableInstructorIds },
      { headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
