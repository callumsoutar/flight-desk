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
      { error: "Account not configured" },
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
    ])

    if (tenantResult.error) throw tenantResult.error
    if (syllabiResult.error) throw syllabiResult.error
    if (enrollmentsResult.error) throw enrollmentsResult.error

    const instructorIds = [
      ...new Set((enrollmentsResult.data ?? []).map((e) => e.primary_instructor_id).filter(Boolean)),
    ] as string[]

    let primaryInstructors: MemberTrainingResponse["training"]["primaryInstructors"] = []
    if (instructorIds.length) {
      const { data, error } = await supabase
        .from("instructors")
        .select("id, user_id, first_name, last_name, user:user_directory!instructors_user_id_fkey(first_name, last_name, email)")
        .eq("tenant_id", tenantId)
        .in("id", instructorIds)

      if (error) throw error
      primaryInstructors = (data ?? []) as MemberTrainingResponse["training"]["primaryInstructors"]
    }

    const payload: MemberTrainingResponse = {
      training: {
        timeZone: tenantResult.data?.timezone ?? "Pacific/Auckland",
        syllabi: syllabiResult.data ?? [],
        enrollments: enrollmentsResult.data ?? [],
        primaryInstructors,
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
