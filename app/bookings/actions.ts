"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import {
  buildBookingUpdatedChanges,
  type BookingUpdatedComparable,
} from "@/lib/email/build-booking-updated-changes"
import { sendBookingUpdatedEmailForBooking } from "@/lib/email/send-booking-updated-for-booking"
import { logError } from "@/lib/security/logger"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { BookingStatus } from "@/lib/types/bookings"

const bookingSchema = z.strictObject({
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
  checked_out_aircraft_id: z.string().uuid().nullable(),
  eta: z.string().nullable(),
  fuel_on_board: z.number().nullable(),
  route: z.string().nullable(),
  passengers: z.string().nullable(),
  flight_remarks: z.string().nullable(),
  briefing_completed: z.boolean(),
  authorization_completed: z.boolean(),
})

const cancelBookingSchema = z.strictObject({
  cancellation_category_id: z.string().uuid(),
  cancellation_reason: z.string().trim().min(1).max(500),
  cancelled_notes: z.string().max(2000).nullable().optional(),
})

const BOOKING_EMAIL_SELECT =
  "id, tenant_id, user_id, start_time, end_time, aircraft_id, instructor_id, lesson_id, purpose, remarks, student:user_directory!bookings_user_id_fkey(id, first_name, last_name, email), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user:user_directory!instructors_user_id_fkey(first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(id, registration), lesson:lessons!bookings_lesson_id_fkey(id, name), flight_type:flight_types!bookings_flight_type_id_fkey(id, name)"

function formatInstructorName(instructor: {
  first_name?: string | null
  last_name?: string | null
  user?: { first_name?: string | null; last_name?: string | null } | null
} | null): string | null {
  if (!instructor) return null
  const fromUser = [instructor.user?.first_name, instructor.user?.last_name].filter(Boolean).join(" ").trim()
  if (fromUser) return fromUser
  const direct = [instructor.first_name, instructor.last_name].filter(Boolean).join(" ").trim()
  return direct || null
}

function toComparableBooking(input: {
  aircraft?: { registration?: string | null } | null
  instructor?: {
    first_name?: string | null
    last_name?: string | null
    user?: { first_name?: string | null; last_name?: string | null } | null
  } | null
  purpose?: string | null
  remarks?: string | null
  lesson?: { name?: string | null } | null
}): BookingUpdatedComparable {
  return {
    aircraftRegistration: input.aircraft?.registration ?? null,
    instructorName: formatInstructorName(input.instructor ?? null),
    purpose: input.purpose ?? null,
    description: input.remarks ?? null,
    lessonName: input.lesson?.name ?? null,
  }
}

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

  const { supabase, user, role, tenantId } = await getTenantContextWithRole()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (!tenantId) return { ok: false, error: "Missing tenant context" }

  const { data: existing, error: existingError } = await supabase
    .from("bookings")
    .select(BOOKING_EMAIL_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle()

  if (existingError || !existing) return { ok: false, error: "Failed to load booking" }

  if (!isStaffRole(role) && existing.user_id !== user.id) {
    return { ok: false, error: "Forbidden" }
  }

  const { data: updated, error } = await supabase
    .from("bookings")
    .update(parsed.data)
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .select(BOOKING_EMAIL_SELECT)
    .maybeSingle()

  if (error || !updated) return { ok: false, error: "Failed to update booking" }

  try {
    const changes = buildBookingUpdatedChanges(
      toComparableBooking(existing as Parameters<typeof toComparableBooking>[0]),
      toComparableBooking(updated as Parameters<typeof toComparableBooking>[0])
    )

    if (changes.length > 0) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, logo_url, contact_email, timezone")
        .eq("id", tenantId)
        .maybeSingle()

      await sendBookingUpdatedEmailForBooking({
        supabase,
        tenantId,
        bookingId,
        bookingUserId: updated.user_id,
        triggeredBy: user.id,
        booking: updated as Record<string, unknown>,
        tenant,
        changes,
      })
    }
  } catch (emailErr) {
    logError("[email] Trigger send failed (non-fatal)", { error: emailErr, tenantId, bookingId })
  }

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

  revalidatePath("/bookings")
  revalidatePath(`/bookings/${bookingId}`)
  return { ok: true as const }
}

export async function cancelBookingAction(
  bookingId: string,
  input: unknown
) {
  const parsed = cancelBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid cancellation payload" }
  }

  const { supabase, user, tenantId, role } = await getTenantContextWithRole()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (!tenantId) return { ok: false, error: "Missing tenant context" }

  const { data: existing, error: existingError } = await supabase
    .from("bookings")
    .select("id, user_id, status")
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle()

  if (existingError || !existing) {
    return { ok: false as const, error: "Booking not found" }
  }
  if (existing.status === "cancelled" || existing.status === "complete") {
    return { ok: false as const, error: "This booking cannot be cancelled" }
  }
  const staff = isStaffRole(role)
  const isOwn = existing.user_id === user.id
  if (!staff && !isOwn) {
    return { ok: false as const, error: "You can only cancel your own bookings" }
  }

  const { data: category, error: categoryError } = await supabase
    .from("cancellation_categories")
    .select("id")
    .eq("id", parsed.data.cancellation_category_id)
    .eq("tenant_id", tenantId)
    .is("voided_at", null)
    .maybeSingle()

  if (categoryError || !category) {
    return { ok: false as const, error: "Invalid cancellation category" }
  }

  const cancelledNotes = parsed.data.cancelled_notes?.trim() ?? null

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      cancellation_category_id: parsed.data.cancellation_category_id,
      cancellation_reason: parsed.data.cancellation_reason,
      cancelled_notes: cancelledNotes || null,
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

  const {
    checked_out_aircraft_id: checkedOutAircraftId,
    ...checkoutData
  } = parsed.data
  const resolvedCheckedOutAircraftId = checkedOutAircraftId ?? checkoutData.aircraft_id
  if (!resolvedCheckedOutAircraftId) {
    return { ok: false as const, error: "Aircraft is required before checkout" }
  }

  const nowIso = new Date().toISOString()
  const payload = {
    ...checkoutData,
    status: "flying" as BookingStatus,
    checked_out_at: nowIso,
    checked_out_aircraft_id: resolvedCheckedOutAircraftId,
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

  const updateData = parsed.data

  const { error } = await supabase
    .from("bookings")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)

  if (error) return { ok: false as const, error: "Failed to update checkout details" }

  revalidatePath("/bookings")
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath(`/bookings/checkout/${bookingId}`)
  return { ok: true as const }
}
