import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchBookings } from "@/lib/bookings/fetch-bookings"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { MemberFlightHistoryResponse } from "@/lib/types/flight-history"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params

  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase)

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

  const canViewOtherMembers = role === "owner" || role === "admin" || role === "instructor"
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const flights = await fetchBookings(supabase, tenantId, {
      user_id: targetUserId,
      status: ["complete"],
    })

    flights.sort((a, b) => {
      const aTime = a.end_time ? new Date(a.end_time).getTime() : 0
      const bTime = b.end_time ? new Date(b.end_time).getTime() : 0
      return bTime - aTime
    })

    const payload: MemberFlightHistoryResponse = { flights }

    return NextResponse.json(payload, {
      headers: { "cache-control": "no-store" },
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to load flight history" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
