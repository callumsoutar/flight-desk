import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { isStaffRole } from "@/lib/auth/roles"
import type { MemberTrainingPeekInstructor, MemberTrainingPeekResponse } from "@/lib/types/member-training-peek"

export const dynamic = "force-dynamic"

function lower(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase()
}

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

  if (targetUserId !== user.id && role === "instructor") {
    const { data: canManage, error } = await supabase.rpc("can_manage_user", {
      p_user_id: targetUserId,
    })

    if (error || !canManage) {
      return noStoreJson({ error: "Forbidden" }, { status: 403 })
    }
  }

  try {
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from("student_syllabus_enrollment")
      .select(
        "id, status, enrolled_at, completion_date, primary_instructor_id, aircraft_type, syllabus_id, syllabus:syllabus!student_syllabus_enrollment_syllabus_id_fkey(id, name), aircraft_types:aircraft_types!student_syllabus_enrollment_aircraft_type_fkey(id, name)"
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(20)

    if (enrollmentsError) throw enrollmentsError

    const enrollmentRow = (enrollments ?? []).find(
      (e) => lower(e.status) === "active" && !e.completion_date
    ) ?? (enrollments ?? [])[0] ?? null

    if (!enrollmentRow) {
      const payload: MemberTrainingPeekResponse = {
        enrollment: null,
        next_lesson: null,
        suggested_lesson: null,
        next_lesson_booking: null,
      }
      return noStoreJson(payload)
    }

    let primaryInstructor: MemberTrainingPeekInstructor | null = null

    if (enrollmentRow.primary_instructor_id) {
      const { data, error } = await supabase
        .from("instructors")
        .select("id, first_name, last_name, user:user_directory!instructors_user_id_fkey(first_name, last_name, email)")
        .eq("tenant_id", tenantId)
        .eq("id", enrollmentRow.primary_instructor_id)
        .maybeSingle()

      if (error) throw error

      const userRow = (data as unknown as { user: { first_name: string | null; last_name: string | null; email: string | null } | null })
        ?.user

      primaryInstructor = data
        ? {
            id: data.id,
            first_name: userRow?.first_name ?? data.first_name ?? null,
            last_name: userRow?.last_name ?? data.last_name ?? null,
            email: userRow?.email ?? null,
          }
        : null
    }

    const syllabusId = enrollmentRow.syllabus_id ?? null

    let nextLesson: MemberTrainingPeekResponse["next_lesson"] = null
    let suggestedLesson: MemberTrainingPeekResponse["suggested_lesson"] = null
    let nextLessonBooking: MemberTrainingPeekResponse["next_lesson_booking"] = null
    if (syllabusId) {
      const nowIso = new Date().toISOString()
      const [lessonsResult, progressResult] = await Promise.all([
        supabase
          .from("lessons")
          .select("id, name, order, is_active, is_required")
          .eq("tenant_id", tenantId)
          .eq("syllabus_id", syllabusId)
          .order("order", { ascending: true }),
        supabase
          .from("lesson_progress")
          .select("lesson_id, status")
          .eq("tenant_id", tenantId)
          .eq("user_id", targetUserId)
          .eq("syllabus_id", syllabusId)
          .not("lesson_id", "is", null),
      ])

      if (lessonsResult.error) throw lessonsResult.error
      if (progressResult.error) throw progressResult.error

      const completedLessonIds = new Set(
        (progressResult.data ?? [])
          .filter((a) => a.status === "pass" && a.lesson_id)
          .map((a) => a.lesson_id as string)
      )

      const eligibleLessons = (lessonsResult.data ?? []).filter((l) => {
        if (l.is_active === false) return false
        if (l.is_required === false) return false
        return true
      })

      const lessonIds = (lessonsResult.data ?? []).map((l) => l.id).filter(Boolean) as string[]
      const next = eligibleLessons.find((l) => !completedLessonIds.has(l.id)) ?? null
      nextLesson = next ? { id: next.id, name: next.name, order: next.order } : null

      // If the "next lesson" is already scheduled in the future, suggest the next unpassed lesson
      // that isn't already booked (so staff can quickly book "the one after").
      let bookedLessonIds = new Set<string>()
      if (lessonIds.length) {
        const { data: bookings, error } = await supabase
          .from("bookings")
          .select("id, start_time, end_time, status, lesson_id")
          .eq("tenant_id", tenantId)
          .eq("user_id", targetUserId)
          .gte("start_time", nowIso)
          .neq("status", "cancelled")
          .in("lesson_id", lessonIds)
          .order("start_time", { ascending: true })
          .limit(25)

        if (error) throw error

        bookedLessonIds = new Set((bookings ?? []).map((b) => b.lesson_id).filter(Boolean) as string[])

        if (nextLesson?.id) {
          const nextBooked = (bookings ?? []).find((b) => b.lesson_id === nextLesson?.id) ?? null
          nextLessonBooking = nextBooked
            ? {
                id: nextBooked.id,
                start_time: nextBooked.start_time,
                end_time: nextBooked.end_time,
                status: nextBooked.status ?? null,
              }
            : null
        }
      }

      const suggested =
        eligibleLessons.find((l) => !completedLessonIds.has(l.id) && !bookedLessonIds.has(l.id)) ??
        next ??
        null
      suggestedLesson = suggested ? { id: suggested.id, name: suggested.name, order: suggested.order } : null
    }

    const payload: MemberTrainingPeekResponse = {
      enrollment: {
        id: enrollmentRow.id,
        status: enrollmentRow.status ?? null,
        syllabus: enrollmentRow.syllabus ? { id: enrollmentRow.syllabus.id, name: enrollmentRow.syllabus.name } : null,
        aircraft_type: enrollmentRow.aircraft_types
          ? { id: enrollmentRow.aircraft_types.id, name: enrollmentRow.aircraft_types.name }
          : null,
        primary_instructor: primaryInstructor,
      },
      next_lesson: nextLesson,
      suggested_lesson: suggestedLesson,
      next_lesson_booking: nextLessonBooking,
    }

    return noStoreJson(payload)
  } catch {
    return noStoreJson({ error: "Failed to load training peek" }, { status: 500 })
  }
}
