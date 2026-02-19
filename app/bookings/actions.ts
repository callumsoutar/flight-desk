"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { BookingStatus } from "@/lib/types/bookings"

const bookingSchema = z.object({
  start_time: z.string(),
  end_time: z.string(),
  aircraft_id: z.string().uuid().nullable(),
  user_id: z.string().uuid().nullable(),
  instructor_id: z.string().uuid().nullable(),
  flight_type_id: z.string().uuid().nullable(),
  lesson_id: z.string().uuid().nullable(),
  booking_type: z.enum(["flight", "groundwork", "maintenance", "other"]),
  purpose: z.string().min(1, "Purpose is required"),
  remarks: z.string().nullable(),
})

async function getTenantContext() {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, {
    requireUser: true,
    includeTenant: true,
    authoritativeTenant: true,
  })
  if (!user) return { supabase, user: null, tenantId: null }
  return { supabase, user, tenantId }
}

export async function updateBookingAction(bookingId: string, input: unknown) {
  const parsed = bookingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid booking data" }
  }

  const { supabase, user, tenantId } = await getTenantContext()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (!tenantId) return { ok: false, error: "Missing tenant context" }

  const { error } = await supabase
    .from("bookings")
    .update(parsed.data)
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)

  if (error) return { ok: false, error: "Failed to update booking" }

  revalidatePath(`/bookings/${bookingId}`)
  return { ok: true as const }
}

export async function updateBookingStatusAction(
  bookingId: string,
  status: BookingStatus
) {
  const statusSchema = z.enum([
    "unconfirmed",
    "confirmed",
    "briefing",
    "flying",
    "complete",
    "cancelled",
  ])

  if (!statusSchema.safeParse(status).success) {
    return { ok: false, error: "Invalid status" }
  }

  const { supabase, user, tenantId } = await getTenantContext()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (!tenantId) return { ok: false, error: "Missing tenant context" }

  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)

  if (error) return { ok: false, error: "Failed to update booking status" }

  revalidatePath(`/bookings/${bookingId}`)
  return { ok: true as const }
}

export async function cancelBookingAction(
  bookingId: string,
  reason: string | null
) {
  const { supabase, user, tenantId } = await getTenantContext()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (!tenantId) return { ok: false, error: "Missing tenant context" }

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      cancellation_reason: reason,
    })
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)

  if (error) return { ok: false, error: "Failed to cancel booking" }

  revalidatePath(`/bookings/${bookingId}`)
  return { ok: true as const }
}
