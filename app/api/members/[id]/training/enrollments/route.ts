import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { zonedTodayYyyyMmDd } from "@/lib/utils/timezone"

export const dynamic = "force-dynamic"

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const createEnrollmentSchema = z.strictObject({
  syllabus_id: z.string().min(1),
  enrolled_at: dateKeySchema.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  primary_instructor_id: z.string().min(1).nullable().optional(),
  aircraft_type: z.string().min(1).nullable().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params

  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = createEnrollmentSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const [tenantResult, syllabusResult, instructorResult, aircraftTypeResult] = await Promise.all([
    supabase
      .from("tenants")
      .select("timezone")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("syllabus")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", parsed.data.syllabus_id)
      .eq("is_active", true)
      .is("voided_at", null)
      .maybeSingle(),
    parsed.data.primary_instructor_id
      ? supabase
          .from("instructors")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("id", parsed.data.primary_instructor_id)
          .is("voided_at", null)
          .maybeSingle()
      : Promise.resolve({ data: true, error: null }),
    parsed.data.aircraft_type
      ? supabase
          .from("aircraft_types")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("id", parsed.data.aircraft_type)
          .maybeSingle()
      : Promise.resolve({ data: true, error: null }),
  ])

  if (tenantResult.error) {
    return noStoreJson({ error: "Failed to resolve tenant settings" }, { status: 500 })
  }

  const timeZone = tenantResult.data?.timezone ?? "Pacific/Auckland"
  const enrolledAt = parsed.data.enrolled_at ?? zonedTodayYyyyMmDd(timeZone)

  if (!syllabusResult.data) {
    return noStoreJson({ error: "Selected syllabus was not found" }, { status: 404 })
  }

  if (parsed.data.primary_instructor_id && !instructorResult.data) {
    return noStoreJson({ error: "Selected instructor was not found" }, { status: 404 })
  }

  if (parsed.data.aircraft_type && !aircraftTypeResult.data) {
    return noStoreJson({ error: "Selected aircraft type was not found" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("student_syllabus_enrollment")
    .insert({
      tenant_id: tenantId,
      user_id: targetUserId,
      syllabus_id: parsed.data.syllabus_id,
      enrolled_at: enrolledAt,
      unenrolled_at: null,
      notes: parsed.data.notes ?? null,
      primary_instructor_id: parsed.data.primary_instructor_id ?? null,
      aircraft_type: parsed.data.aircraft_type ?? null,
      status: "active",
    })
    .select(
      "id, status, enrolled_at, completion_date, unenrolled_at, notes, primary_instructor_id, aircraft_type, syllabus_id, syllabus:syllabus!student_syllabus_enrollment_syllabus_id_fkey(id, name, description, is_active, voided_at), aircraft_types:aircraft_types!student_syllabus_enrollment_aircraft_type_fkey(id, name)"
    )
    .single()

  if (error) {
    return noStoreJson({ error: "Failed to create enrollment" }, { status: 500 })
  }

  return noStoreJson({ enrollment: data }, { status: 201 })
}
