import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { isStaffRole } from "@/lib/auth/roles"
import { createBookingInTenant, createBookingPayloadSchema } from "@/lib/bookings/create-booking"
import { fetchBookings } from "@/lib/bookings/fetch-bookings"
import { sendBookingConfirmedEmailForBooking } from "@/lib/email/send-booking-confirmed-for-booking"
import { logError } from "@/lib/security/logger"
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
  const session = await getTenantScopedRouteContext({ includeRole: true })
  if (session.response) return session.response
  const { supabase, user, role, tenantId } = session.context

  const userIdParam = request.nextUrl.searchParams.get("user_id")
  const targetUserId = userIdParam ?? user.id

  const canViewOtherMembers = isStaffRole(role)
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 })
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

    return noStoreJson({ bookings })
  } catch {
    return noStoreJson({ error: "Failed to load bookings" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ includeRole: true, authoritativeRole: true })
  if (session.response) return session.response
  const { supabase, user, role, tenantId } = session.context

  const parsed = createBookingPayloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data
  const result = await createBookingInTenant({ supabase, tenantId, user, role, payload })
  if (!result.ok) {
    return noStoreJson({ error: result.error }, { status: result.status })
  }

  try {
    if (payload.status === "confirmed") {
      const booking = result.booking as Record<string, unknown>
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, logo_url, contact_email, timezone")
        .eq("id", tenantId)
        .maybeSingle()

      await sendBookingConfirmedEmailForBooking({
        supabase,
        tenantId,
        bookingId: String(booking.id),
        bookingUserId: (booking.user_id as string | null) ?? null,
        triggeredBy: user.id,
        booking,
        tenant,
      })
    }
  } catch (emailErr) {
    logError("[email] Trigger send failed (non-fatal)", { error: emailErr, tenantId })
  }

  return noStoreJson({ booking: result.booking }, { status: 201 })
}
