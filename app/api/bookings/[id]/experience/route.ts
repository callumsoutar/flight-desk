import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const entrySchema = z.object({
  experience_type_id: z.string().uuid(),
  value: z.number().positive(),
  unit: z.enum(["hours", "count", "landings"]),
  notes: z.string().nullable().optional(),
  conditions: z.string().nullable().optional(),
})

const putSchema = z.object({
  entries: z.array(entrySchema),
})

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

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
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }
  if (!isStaff(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const { id } = await context.params
  const booking = await fetchBookingContext(tenantId, id, supabase).catch(() => null)
  if (!booking) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  const { data, error } = await supabase
    .from("flight_experience")
    .select("experience_type_id, value, unit, notes, conditions")
    .eq("tenant_id", tenantId)
    .eq("booking_id", id)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: "Failed to load booking experience" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { entries: data ?? [] },
    { headers: { "cache-control": "no-store" } }
  )
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }
  if (!isStaff(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const parsed = putSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { id } = await context.params
  const booking = await fetchBookingContext(tenantId, id, supabase).catch(() => null)
  if (!booking) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
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
    return NextResponse.json(
      { error: "Failed to clear existing experience" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  if (parsed.data.entries.length === 0) {
    return NextResponse.json({ entries: [] }, { headers: { "cache-control": "no-store" } })
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
    return NextResponse.json(
      { error: "Booking does not have a valid member for experience logging" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { data, error } = await supabase
    .from("flight_experience")
    .insert(validRows)
    .select("experience_type_id, value, unit, notes, conditions")

  if (error) {
    return NextResponse.json(
      { error: "Failed to save experience entries" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { entries: data ?? [] },
    { headers: { "cache-control": "no-store" } }
  )
}
