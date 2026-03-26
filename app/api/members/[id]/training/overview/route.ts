import { NextRequest, NextResponse } from "next/server"

import { getRequiredApiSession } from "@/lib/auth/api-session"
import { isStaffRole } from "@/lib/auth/roles"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { TrainingStudentOverviewResponse } from "@/lib/types/training-student-overview"

export const dynamic = "force-dynamic"

function cleanSyllabusId(value: string | null) {
  const v = (value ?? "").trim()
  if (!v || v === "all") return null
  return v
}

function asDate(value: string | null | undefined) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getRequiredApiSession(supabase, { includeRole: true })

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

  const canViewOtherMembers = isStaffRole(role)
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  if (targetUserId !== user.id && role === "instructor") {
    const { data: canManage, error } = await supabase.rpc("can_manage_user", {
      p_user_id: targetUserId,
    })

    if (error || !canManage) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: { "cache-control": "no-store" } }
      )
    }
  }

  const syllabusId = cleanSyllabusId(request.nextUrl.searchParams.get("syllabus_id"))
  if (!syllabusId) {
    return NextResponse.json(
      { error: "Missing syllabus_id" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const nowIso = new Date().toISOString()

    const [
      enrollmentResult,
      syllabusResult,
      lessonsResult,
      progressResult,
    ] = await Promise.all([
      supabase
        .from("student_syllabus_enrollment")
        .select("enrolled_at, completion_date, status")
        .eq("tenant_id", tenantId)
        .eq("user_id", targetUserId)
        .eq("syllabus_id", syllabusId)
        .order("enrolled_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("syllabus")
        .select("id, number_of_exams")
        .eq("tenant_id", tenantId)
        .eq("id", syllabusId)
        .maybeSingle(),
      supabase
        .from("lessons")
        .select("id, name, order, is_active, is_required")
        .eq("tenant_id", tenantId)
        .eq("syllabus_id", syllabusId)
        .order("order", { ascending: true }),
      supabase
        .from("lesson_progress")
        .select("lesson_id, status, date")
        .eq("tenant_id", tenantId)
        .eq("user_id", targetUserId)
        .eq("syllabus_id", syllabusId)
        .not("lesson_id", "is", null),
    ])

    if (enrollmentResult.error) throw enrollmentResult.error
    if (syllabusResult.error) throw syllabusResult.error
    if (lessonsResult.error) throw lessonsResult.error
    if (progressResult.error) throw progressResult.error

    const lessonAttempts = progressResult.data ?? []

    const enrolledAtIso = enrollmentResult.data?.enrolled_at ?? null

    const completedLessonIds = new Set(
      lessonAttempts.filter((a) => a.status === "pass" && a.lesson_id).map((a) => a.lesson_id as string)
    )

    const eligibleLessons = (lessonsResult.data ?? []).filter((l) => {
      if (l.is_active === false) return false
      if (l.is_required === false) return false
      return true
    })

    const totalLessons = eligibleLessons.length
    const completedLessons = eligibleLessons.filter((l) => completedLessonIds.has(l.id)).length
    const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : null

    const nextLesson =
      eligibleLessons.find((l) => !completedLessonIds.has(l.id)) ?? null

    const lastActivityAttempt = [...lessonAttempts]
      .map((a) => ({ a, dt: asDate(a.date) }))
      .filter((x) => x.dt)
      .sort((x, y) => (y.dt?.getTime() ?? 0) - (x.dt?.getTime() ?? 0))[0]?.a ?? null

    const lastActivity =
      lastActivityAttempt && lastActivityAttempt.lesson_id
        ? {
            date: lastActivityAttempt.date,
            status: lastActivityAttempt.status ?? null,
            lesson: eligibleLessons.find((l) => l.id === lastActivityAttempt.lesson_id) ?? null,
          }
        : null

    const lessonIds = (lessonsResult.data ?? []).map((l) => l.id).filter(Boolean) as string[]

    const [passedExamsResult, nextBookingResult] = await Promise.all([
      supabase
        .from("exam_results")
        .select("id, result, exam:exam!exam_results_exam_id_fkey(id, syllabus_id)")
        .eq("tenant_id", tenantId)
        .eq("user_id", targetUserId)
        .eq("result", "PASS"),
      lessonIds.length
        ? supabase
            .from("bookings")
            .select(
              "id, start_time, end_time, status, lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user:user_directory!instructors_user_id_fkey(first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(registration)"
            )
            .eq("tenant_id", tenantId)
            .eq("user_id", targetUserId)
            .gte("start_time", nowIso)
            .neq("status", "cancelled")
            .in("lesson_id", lessonIds)
            .order("start_time", { ascending: true })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (passedExamsResult.error) throw passedExamsResult.error
    if (nextBookingResult.error) throw nextBookingResult.error

    const passedExams = (passedExamsResult.data ?? [])
      .filter((r) => r.exam?.syllabus_id === syllabusId)
      .length
    const requiredExams = syllabusResult.data?.number_of_exams ?? 0

    const nextBookingRow = nextBookingResult.data ?? null

    const payload: TrainingStudentOverviewResponse = {
      syllabus_id: syllabusId,
      enrolled_at: enrolledAtIso,
      completion_date: enrollmentResult.data?.completion_date ?? null,
      enrollment_status: enrollmentResult.data?.status ?? null,
      progress: { completed: completedLessons, total: totalLessons, percent },
      theory: { passed: passedExams, required: requiredExams },
      next_lesson: nextLesson ? { id: nextLesson.id, name: nextLesson.name, order: nextLesson.order } : null,
      next_booking: nextBookingRow
        ? {
            id: nextBookingRow.id,
            start_time: nextBookingRow.start_time,
            end_time: nextBookingRow.end_time,
            status: nextBookingRow.status ?? null,
            lesson: nextBookingRow.lesson
              ? { id: nextBookingRow.lesson.id, name: nextBookingRow.lesson.name }
              : null,
            instructor: nextBookingRow.instructor ?? null,
            aircraft: nextBookingRow.aircraft ?? null,
          }
        : null,
      last_activity: lastActivity,
    }

    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json(
      { error: "Failed to load training overview" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
