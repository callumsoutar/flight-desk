import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { MemberTrainingResponse } from "@/lib/types/member-training"

export const dynamic = "force-dynamic"

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

export async function GET(
  _request: NextRequest,
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
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const canViewOtherMembers = isStaff(role)
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const [
      tenantResult,
      syllabiResult,
      enrollmentsResult,
      examResultsResult,
      flightExperienceResult,
    ] = await Promise.all([
      supabase.from("tenants").select("timezone").eq("id", tenantId).maybeSingle(),
      supabase
        .from("syllabus")
        .select("id, name, description, is_active, voided_at, number_of_exams")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .is("voided_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("student_syllabus_enrollment")
        .select(
          "id, status, enrolled_at, completion_date, notes, primary_instructor_id, aircraft_type, syllabus_id, syllabus:syllabus!student_syllabus_enrollment_syllabus_id_fkey(id, name, description, is_active, voided_at), aircraft_types:aircraft_types!student_syllabus_enrollment_aircraft_type_fkey(id, name)"
        )
        .eq("tenant_id", tenantId)
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false }),
      supabase
        .from("exam_results")
        .select(
          "id, exam_id, exam_date, result, score, notes, exam:exam!exam_results_exam_id_fkey(id, name, passing_score, syllabus_id, syllabus:syllabus!exam_syllabus_id_fkey(id, name))"
        )
        .eq("tenant_id", tenantId)
        .eq("user_id", targetUserId)
        .order("exam_date", { ascending: false }),
      supabase
        .from("flight_experience")
        .select(
          "id, occurred_at, value, unit, notes, conditions, experience_type:experience_types!flight_experience_experience_type_id_fkey(id, name), instructor:instructors!flight_experience_instructor_id_fkey(user:user_directory!instructors_user_id_fkey(first_name, last_name)), booking:bookings!flight_experience_booking_id_fkey(aircraft:aircraft!bookings_aircraft_id_fkey(registration))"
        )
        .eq("tenant_id", tenantId)
        .eq("user_id", targetUserId)
        .order("occurred_at", { ascending: false }),
    ])

    if (tenantResult.error) throw tenantResult.error
    if (syllabiResult.error) throw syllabiResult.error
    if (enrollmentsResult.error) throw enrollmentsResult.error
    if (examResultsResult.error) throw examResultsResult.error
    if (flightExperienceResult.error) throw flightExperienceResult.error

    const payload: MemberTrainingResponse = {
      training: {
        timeZone: tenantResult.data?.timezone ?? "Pacific/Auckland",
        syllabi: syllabiResult.data ?? [],
        enrollments: enrollmentsResult.data ?? [],
        examResults: examResultsResult.data ?? [],
        flightExperience: flightExperienceResult.data ?? [],
      },
    }

    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json(
      { error: "Failed to load training data" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

