import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchBookingCheckoutWarnings } from "@/lib/bookings/fetch-booking-checkout-warnings"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  try {
    const warnings = await fetchBookingCheckoutWarnings(supabase, tenantId, {
      bookingId: id,
      userId: request.nextUrl.searchParams.get("user_id"),
      instructorId: request.nextUrl.searchParams.get("instructor_id"),
      aircraftId: request.nextUrl.searchParams.get("aircraft_id"),
    })

    return noStoreJson(warnings)
  } catch {
    return noStoreJson({ error: "Failed to load booking warnings" }, { status: 500 })
  }
}
