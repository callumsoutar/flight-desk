import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { isStaffRole } from "@/lib/auth/roles"
import { fetchBookings } from "@/lib/bookings/fetch-bookings"
import type { MemberFlightHistoryResponse } from "@/lib/types/flight-history"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params

  const session = await getTenantScopedRouteContext({ includeRole: true })
  if (session.response) return session.response
  const { supabase, user, role, tenantId } = session.context

  const canViewOtherMembers = isStaffRole(role)
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 })
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

    return noStoreJson(payload)
  } catch {
    return noStoreJson({ error: "Failed to load flight history" }, { status: 500 })
  }
}
