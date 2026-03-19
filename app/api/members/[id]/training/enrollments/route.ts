import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { zonedTodayYyyyMmDd } from "@/lib/utils/timezone"

export const dynamic = "force-dynamic"

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const createEnrollmentSchema = z.object({
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
      { error: "Account not configured" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }
  if (!isStaffRole(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const raw = await request.json().catch(() => null)
  const parsed = createEnrollmentSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
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
    return NextResponse.json(
      { error: "Failed to resolve tenant settings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  const timeZone = tenantResult.data?.timezone ?? "Pacific/Auckland"
  const enrolledAt = parsed.data.enrolled_at ?? zonedTodayYyyyMmDd(timeZone)

  if (!syllabusResult.data) {
    return NextResponse.json(
      { error: "Selected syllabus was not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  if (parsed.data.primary_instructor_id && !instructorResult.data) {
    return NextResponse.json(
      { error: "Selected instructor was not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  if (parsed.data.aircraft_type && !aircraftTypeResult.data) {
    return NextResponse.json(
      { error: "Selected aircraft type was not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  const { data, error } = await supabase
    .from("student_syllabus_enrollment")
    .insert({
      tenant_id: tenantId,
      user_id: targetUserId,
      syllabus_id: parsed.data.syllabus_id,
      enrolled_at: enrolledAt,
      notes: parsed.data.notes ?? null,
      primary_instructor_id: parsed.data.primary_instructor_id ?? null,
      aircraft_type: parsed.data.aircraft_type ?? null,
      status: "active",
    })
    .select(
      "id, status, enrolled_at, completion_date, notes, primary_instructor_id, aircraft_type, syllabus_id, syllabus:syllabus!student_syllabus_enrollment_syllabus_id_fkey(id, name, description, is_active, voided_at), aircraft_types:aircraft_types!student_syllabus_enrollment_aircraft_type_fkey(id, name)"
    )
    .single()

  if (error) {
    return NextResponse.json(
      { error: "Failed to create enrollment" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { enrollment: data },
    { status: 201, headers: { "cache-control": "no-store" } }
  )
}

