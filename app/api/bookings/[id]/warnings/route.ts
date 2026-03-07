import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { fetchBookingCheckoutWarnings } from "@/lib/bookings/fetch-booking-checkout-warnings"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }

  if (!tenantId) {
    return NextResponse.json(
      { error: "Account not configured" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const warnings = await fetchBookingCheckoutWarnings(supabase, tenantId, {
      bookingId: id,
      userId: request.nextUrl.searchParams.get("user_id"),
      instructorId: request.nextUrl.searchParams.get("instructor_id"),
      aircraftId: request.nextUrl.searchParams.get("aircraft_id"),
    })

    return NextResponse.json(warnings, {
      headers: { "cache-control": "no-store" },
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to load booking warnings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
