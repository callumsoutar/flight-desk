import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { invalidPayloadResponse } from "@/lib/security/http"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const entrySchema = z.strictObject({
  experience_type_id: z.string().uuid(),
  value: z.number().positive(),
  unit: z.enum(["hours", "count", "landings"]),
  notes: z.string().nullable().optional(),
  conditions: z.string().nullable().optional(),
})

const putSchema = z.strictObject({
  entries: z.array(entrySchema),
})

async function fetchBookingContext(
  tenantId: string,
  bookingId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, user_id, instructor_id, end_time")
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const ctx = await getTenantStaffRouteContext(supabase)
  if (ctx.response) return ctx.response
  const { tenantId } = ctx.context

  const { id } = await context.params
  const booking = await fetchBookingContext(tenantId, id, supabase).catch(() => null)
  if (!booking) {
    return noStoreJson({ error: "Booking not found" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("flight_experience")
    .select("experience_type_id, value, unit, notes, conditions")
    .eq("tenant_id", tenantId)
    .eq("booking_id", id)
    .order("created_at", { ascending: true })

  if (error) {
    return noStoreJson({ error: "Failed to load booking experience" }, { status: 500 })
  }

  return noStoreJson({ entries: data ?? [] })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const ctx = await getTenantStaffRouteContext(supabase)
  if (ctx.response) return ctx.response
  const { user, tenantId } = ctx.context

  const parsed = putSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return invalidPayloadResponse()
  }

  const { id } = await context.params
  const booking = await fetchBookingContext(tenantId, id, supabase).catch(() => null)
  if (!booking) {
    return noStoreJson({ error: "Booking not found" }, { status: 404 })
  }

  const { data: lessonProgress } = await supabase
    .from("lesson_progress")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("booking_id", id)
    .order("created_at", { ascending: false })
    .maybeSingle()

  const { error: deleteError } = await supabase
    .from("flight_experience")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("booking_id", id)

  if (deleteError) {
    return noStoreJson({ error: "Failed to clear existing experience" }, { status: 500 })
  }

  if (parsed.data.entries.length === 0) {
    return noStoreJson({ entries: [] })
  }

  const occurredAt = booking.end_time ?? new Date().toISOString()
  const rows = parsed.data.entries.map((entry) => ({
    tenant_id: tenantId,
    booking_id: id,
    lesson_progress_id: lessonProgress?.id ?? null,
    user_id: booking.user_id,
    instructor_id: booking.instructor_id,
    experience_type_id: entry.experience_type_id,
    value: entry.value,
    unit: entry.unit,
    notes: entry.notes ?? null,
    conditions: entry.conditions ?? null,
    occurred_at: occurredAt,
    created_by: user.id,
  }))

  const validRows = rows.filter((row): row is typeof row & { user_id: string } => Boolean(row.user_id))
  if (validRows.length !== rows.length) {
    return noStoreJson(
      { error: "Booking does not have a valid member for experience logging" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("flight_experience")
    .insert(validRows)
    .select("experience_type_id, value, unit, notes, conditions")

  if (error) {
    return noStoreJson({ error: "Failed to save experience entries" }, { status: 500 })
  }

  return noStoreJson({ entries: data ?? [] })
}
