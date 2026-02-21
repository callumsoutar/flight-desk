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

const checkoutSchema = bookingSchema.extend({
  eta: z.string().nullable(),
  fuel_on_board: z.number().nullable(),
  route: z.string().nullable(),
  passengers: z.string().nullable(),
  flight_remarks: z.string().nullable(),
  briefing_completed: z.boolean(),
  authorization_completed: z.boolean(),
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

async function getTenantContextWithRole() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    includeTenant: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })
  if (!user) return { supabase, user: null, role: null, tenantId: null }
  return { supabase, user, role, tenantId }
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

export async function authorizeBookingCheckoutAction(bookingId: string, input: unknown) {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid checkout data" }
  }

  const { supabase, user, role, tenantId } = await getTenantContextWithRole()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }

  const isStaff = role === "owner" || role === "admin" || role === "instructor"
  if (!isStaff) return { ok: false as const, error: "Only staff can authorize checkout" }

  const { data: existing, error: existingError } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle()

  if (existingError) return { ok: false as const, error: "Failed to load booking" }
  if (!existing) return { ok: false as const, error: "Booking not found" }
  if (existing.status === "cancelled" || existing.status === "complete") {
    return { ok: false as const, error: "This booking can no longer be checked out" }
  }
  if (existing.status !== "confirmed") {
    return { ok: false as const, error: "Only confirmed bookings can be checked out" }
  }
  if (!parsed.data.authorization_completed) {
    return { ok: false as const, error: "Authorization must be completed before checkout" }
  }

  const nowIso = new Date().toISOString()
  const payload = {
    ...parsed.data,
    status: "flying" as BookingStatus,
    checked_out_at: nowIso,
    checked_out_aircraft_id: parsed.data.aircraft_id,
    checked_out_instructor_id: parsed.data.instructor_id,
  }

  const { error } = await supabase
    .from("bookings")
    .update(payload)
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)

  if (error) return { ok: false as const, error: "Failed to authorize checkout" }

  revalidatePath("/bookings")
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath(`/bookings/checkout/${bookingId}`)
  return { ok: true as const }
}

export async function updateBookingCheckoutDetailsAction(bookingId: string, input: unknown) {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid checkout data" }
  }

  const { supabase, user, tenantId } = await getTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }

  const { data: existing, error: existingError } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle()

  if (existingError) return { ok: false as const, error: "Failed to load booking" }
  if (!existing) return { ok: false as const, error: "Booking not found" }
  if (existing.status === "cancelled" || existing.status === "complete") {
    return { ok: false as const, error: "This booking can no longer be edited" }
  }

  const { error } = await supabase
    .from("bookings")
    .update(parsed.data)
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)

  if (error) return { ok: false as const, error: "Failed to update checkout details" }

  revalidatePath("/bookings")
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath(`/bookings/checkout/${bookingId}`)
  return { ok: true as const }
}
