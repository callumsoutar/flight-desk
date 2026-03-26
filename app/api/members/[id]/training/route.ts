import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { isStaffRole } from "@/lib/auth/roles"
import type { MemberTrainingResponse } from "@/lib/types/member-training"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params

  const session = await getTenantScopedRouteContext({ includeRole: true })
  if (session.response) return session.response
  const { supabase, user, role, tenantId } = session.context

  const canViewOtherMembers = isStaffRole(role)
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 })
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

    return noStoreJson(payload)
  } catch {
    return noStoreJson({ error: "Failed to load training data" }, { status: 500 })
  }
}
