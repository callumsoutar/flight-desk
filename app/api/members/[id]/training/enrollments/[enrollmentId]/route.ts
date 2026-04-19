import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

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

  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = updateEnrollmentSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("student_syllabus_enrollment")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", targetUserId)
    .eq("id", enrollmentId)
    .maybeSingle()

  if (existingError) {
    return noStoreJson({ error: "Failed to load enrollment" }, { status: 500 })
  }
  if (!existing) {
    return noStoreJson({ error: "Enrollment not found" }, { status: 404 })
  }

  if (parsed.data.primary_instructor_id) {
    const { data: instructor } = await supabase
      .from("instructors")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", parsed.data.primary_instructor_id)
      .is("voided_at", null)
      .maybeSingle()

    if (!instructor) {
      return noStoreJson({ error: "Selected instructor was not found" }, { status: 404 })
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
      return noStoreJson({ error: "Selected aircraft type was not found" }, { status: 404 })
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
    return noStoreJson({ error: "Failed to update enrollment" }, { status: 500 })
  }

  return noStoreJson({ ok: true })
}
