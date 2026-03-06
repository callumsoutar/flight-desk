import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const updateEnrollmentSchema = z
  .object({
    enrolled_at: dateKeySchema.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    primary_instructor_id: z.string().min(1).nullable().optional(),
    aircraft_type: z.string().min(1).nullable().optional(),
  })
  .strict()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> }
) {
  const { id: targetUserId, enrollmentId } = await params

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, { includeRole: true, includeTenant: true })

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

  const raw = await request.json().catch(() => null)
  const parsed = updateEnrollmentSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: existing, error: existingError } = await supabase
    .from("student_syllabus_enrollment")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", targetUserId)
    .eq("id", enrollmentId)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json(
      { error: "Failed to load enrollment" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
  if (!existing) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  if (parsed.data.primary_instructor_id) {
    const { data: instructor } = await supabase
      .from("instructors")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", parsed.data.primary_instructor_id)
      .maybeSingle()

    if (!instructor) {
      return NextResponse.json(
        { error: "Selected instructor was not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }
  }

  if (parsed.data.aircraft_type) {
    const { data: aircraftType } = await supabase
      .from("aircraft_types")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", parsed.data.aircraft_type)
      .maybeSingle()

    if (!aircraftType) {
      return NextResponse.json(
        { error: "Selected aircraft type was not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }
  }

  const { error } = await supabase
    .from("student_syllabus_enrollment")
    .update({
      enrolled_at: parsed.data.enrolled_at ?? undefined,
      notes: parsed.data.notes ?? undefined,
      primary_instructor_id: parsed.data.primary_instructor_id ?? undefined,
      aircraft_type: parsed.data.aircraft_type ?? undefined,
    })
    .eq("tenant_id", tenantId)
    .eq("user_id", targetUserId)
    .eq("id", enrollmentId)

  if (error) {
    return NextResponse.json(
      { error: "Failed to update enrollment" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } }
  )
}

