import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchBookings } from "@/lib/bookings/fetch-bookings"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { BookingStatus } from "@/lib/types/bookings"

export const dynamic = "force-dynamic"

const ALLOWED_STATUSES: BookingStatus[] = [
  "unconfirmed",
  "confirmed",
  "briefing",
  "flying",
  "complete",
  "cancelled",
]

export async function GET(request: NextRequest) {
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

  const userIdParam = request.nextUrl.searchParams.get("user_id")
  const targetUserId = userIdParam ?? user.id

  const canViewOtherMembers = role === "owner" || role === "admin" || role === "instructor"
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const statusParam = request.nextUrl.searchParams.get("status")
  const parsedStatuses = (statusParam ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean) as BookingStatus[]

  const statuses = parsedStatuses.filter((status): status is BookingStatus =>
    ALLOWED_STATUSES.includes(status)
  )

  try {
    const bookings = await fetchBookings(supabase, tenantId, {
      user_id: targetUserId,
      status: statuses.length > 0 ? statuses : undefined,
    })

    return NextResponse.json(
      { bookings },
      { headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to load bookings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
