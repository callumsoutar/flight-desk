"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { fetchInstructorDetail } from "@/lib/instructors/fetch-instructor-detail"
import { fetchInstructorRates } from "@/lib/instructors/fetch-instructor-rates"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const updateInstructorDetailsSchema = z.object({
  userId: z.string().uuid(),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  rating: z.string().uuid().nullable(),
  instructor_check_due_date: z.string().nullable(),
  instrument_check_due_date: z.string().nullable(),
  class_1_medical_due_date: z.string().nullable(),
  employment_type: z.enum(["full_time", "part_time", "casual", "contractor"]).nullable(),
  is_actively_instructing: z.boolean(),
  status: z.enum(["active", "inactive", "deactivated", "suspended"]),
  night_removal: z.boolean(),
  aerobatics_removal: z.boolean(),
  multi_removal: z.boolean(),
  tawa_removal: z.boolean(),
  ifr_removal: z.boolean(),
})

const updateInstructorNotesSchema = z.object({
  userId: z.string().uuid(),
  notes: z.string().nullable(),
})

const instructorRateDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const createInstructorRateSchema = z.object({
  instructorId: z.string().uuid(),
  flight_type_id: z.string().uuid(),
  rate_per_hour: z.number().finite().min(0),
  effective_from: instructorRateDateSchema,
  currency: z.string().trim().length(3).optional(),
})

const updateInstructorRateSchema = z.object({
  id: z.string().uuid(),
  rate_per_hour: z.number().finite().min(0),
  effective_from: instructorRateDateSchema,
})

const deleteInstructorRateSchema = z.object({
  id: z.string().uuid(),
})

export type UpdateInstructorDetailsInput = z.infer<typeof updateInstructorDetailsSchema>
export type UpdateInstructorNotesInput = z.infer<typeof updateInstructorNotesSchema>
export type CreateInstructorRateInput = z.infer<typeof createInstructorRateSchema>
export type UpdateInstructorRateInput = z.infer<typeof updateInstructorRateSchema>
export type DeleteInstructorRateInput = z.infer<typeof deleteInstructorRateSchema>

function normalizeNullableString(value: string | null) {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

async function requireTenantContext() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })
  if (!user) return { supabase, user: null, role: null, tenantId: null }
  return { supabase, user, role, tenantId }
}

function canEditInstructor(role: string | null) {
  if (!role) return false
  return role === "owner" || role === "admin" || role === "instructor"
}

async function verifyInstructorInTenant(tenantId: string, userId: string) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("instructors")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) return null
  return data.id
}

async function verifyInstructorByIdInTenant(
  tenantId: string,
  instructorId: string
) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("instructors")
    .select("id, user_id")
    .eq("tenant_id", tenantId)
    .eq("id", instructorId)
    .maybeSingle()

  if (error || !data) return null
  return data
}

async function verifyFlightTypeInTenant(tenantId: string, flightTypeId: string) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("flight_types")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", flightTypeId)
    .eq("is_active", true)
    .is("voided_at", null)
    .maybeSingle()

  if (error || !data) return false
  return true
}

export async function updateInstructorDetailsAction(input: unknown) {
  const parsed = updateInstructorDetailsSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid instructor details" }

  const { supabase, user, role, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }
  if (!canEditInstructor(role)) return { ok: false as const, error: "Forbidden" }

  const {
    userId,
    first_name,
    last_name,
    rating,
    instructor_check_due_date,
    instrument_check_due_date,
    class_1_medical_due_date,
    employment_type,
    is_actively_instructing,
    status,
    night_removal,
    aerobatics_removal,
    multi_removal,
    tawa_removal,
    ifr_removal,
  } = parsed.data

  const instructorId = await verifyInstructorInTenant(tenantId, userId)
  if (!instructorId) return { ok: false as const, error: "Instructor not found" }

  const { error: userUpdateError } = await supabase
    .from("users")
    .update({ first_name, last_name })
    .eq("id", userId)

  if (userUpdateError) return { ok: false as const, error: "Failed to update instructor user profile" }

  const { error: instructorUpdateError } = await supabase
    .from("instructors")
    .update({
      rating,
      instructor_check_due_date: normalizeNullableString(instructor_check_due_date),
      instrument_check_due_date: normalizeNullableString(instrument_check_due_date),
      class_1_medical_due_date: normalizeNullableString(class_1_medical_due_date),
      employment_type,
      is_actively_instructing,
      status,
      night_removal,
      aerobatics_removal,
      multi_removal,
      tawa_removal,
      ifr_removal,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", instructorId)

  if (instructorUpdateError) return { ok: false as const, error: "Failed to update instructor details" }

  const updated = await fetchInstructorDetail(supabase, tenantId, userId)
  if (!updated) return { ok: false as const, error: "Instructor no longer available" }

  revalidatePath(`/instructors/${userId}`)
  revalidatePath("/instructors")
  revalidatePath(`/members/${userId}`)

  return { ok: true as const, instructor: updated }
}

export async function updateInstructorNotesAction(input: unknown) {
  const parsed = updateInstructorNotesSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid notes payload" }

  const { supabase, user, role, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }
  if (!canEditInstructor(role)) return { ok: false as const, error: "Forbidden" }

  const { userId, notes } = parsed.data
  const instructorId = await verifyInstructorInTenant(tenantId, userId)
  if (!instructorId) return { ok: false as const, error: "Instructor not found" }

  const { error } = await supabase
    .from("instructors")
    .update({ notes: normalizeNullableString(notes), updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", instructorId)

  if (error) return { ok: false as const, error: "Failed to update instructor notes" }

  const updated = await fetchInstructorDetail(supabase, tenantId, userId)
  if (!updated) return { ok: false as const, error: "Instructor no longer available" }

  revalidatePath(`/instructors/${userId}`)
  revalidatePath("/instructors")

  return { ok: true as const, instructor: updated }
}

export async function createInstructorRateAction(input: unknown) {
  const parsed = createInstructorRateSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid rate payload" }

  const { supabase, user, role, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }
  if (!canEditInstructor(role)) return { ok: false as const, error: "Forbidden" }

  const { instructorId, flight_type_id, rate_per_hour, effective_from, currency } = parsed.data
  const instructor = await verifyInstructorByIdInTenant(tenantId, instructorId)
  if (!instructor) return { ok: false as const, error: "Instructor not found" }

  const hasFlightType = await verifyFlightTypeInTenant(tenantId, flight_type_id)
  if (!hasFlightType) return { ok: false as const, error: "Flight type not found" }

  const { data: existingRate, error: existingRateError } = await supabase
    .from("instructor_flight_type_rates")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("instructor_id", instructorId)
    .eq("flight_type_id", flight_type_id)
    .maybeSingle()

  if (existingRateError) return { ok: false as const, error: "Failed to validate existing rates" }
  if (existingRate) return { ok: false as const, error: "Rate for this flight type already exists" }

  const { error } = await supabase
    .from("instructor_flight_type_rates")
    .insert({
      instructor_id: instructorId,
      flight_type_id,
      rate: rate_per_hour,
      currency: (currency ?? "NZD").toUpperCase(),
      effective_from,
    })

  if (error) return { ok: false as const, error: "Failed to add rate" }

  const rates = await fetchInstructorRates(supabase, tenantId, instructorId)

  revalidatePath(`/instructors/${instructor.user_id}`)
  revalidatePath("/instructors")

  return { ok: true as const, rates }
}

export async function updateInstructorRateAction(input: unknown) {
  const parsed = updateInstructorRateSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid rate payload" }

  const { supabase, user, role, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }
  if (!canEditInstructor(role)) return { ok: false as const, error: "Forbidden" }

  const { id, rate_per_hour, effective_from } = parsed.data

  const { data: existingRate, error: rateLookupError } = await supabase
    .from("instructor_flight_type_rates")
    .select("id, instructor_id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (rateLookupError || !existingRate) return { ok: false as const, error: "Rate not found" }

  const { error } = await supabase
    .from("instructor_flight_type_rates")
    .update({
      rate: rate_per_hour,
      effective_from,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (error) return { ok: false as const, error: "Failed to update rate" }

  const instructor = await verifyInstructorByIdInTenant(tenantId, existingRate.instructor_id)
  if (!instructor) return { ok: false as const, error: "Instructor not found" }

  const rates = await fetchInstructorRates(supabase, tenantId, instructor.id)

  revalidatePath(`/instructors/${instructor.user_id}`)
  revalidatePath("/instructors")

  return { ok: true as const, rates }
}

export async function deleteInstructorRateAction(input: unknown) {
  const parsed = deleteInstructorRateSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid rate payload" }

  const { supabase, user, role, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }
  if (!canEditInstructor(role)) return { ok: false as const, error: "Forbidden" }

  const { id } = parsed.data

  const { data: existingRate, error: rateLookupError } = await supabase
    .from("instructor_flight_type_rates")
    .select("id, instructor_id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (rateLookupError || !existingRate) return { ok: false as const, error: "Rate not found" }

  const { error } = await supabase
    .from("instructor_flight_type_rates")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (error) return { ok: false as const, error: "Failed to delete rate" }

  const instructor = await verifyInstructorByIdInTenant(tenantId, existingRate.instructor_id)
  if (!instructor) return { ok: false as const, error: "Instructor not found" }

  const rates = await fetchInstructorRates(supabase, tenantId, instructor.id)

  revalidatePath(`/instructors/${instructor.user_id}`)
  revalidatePath("/instructors")

  return { ok: true as const, rates }
}
