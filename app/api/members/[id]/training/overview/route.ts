import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { TrainingStudentOverviewResponse } from "@/lib/types/training-student-overview"

export const dynamic = "force-dynamic"

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

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

function monthsBetween(start: Date, end: Date) {
  const diffMs = end.getTime() - start.getTime()
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0
  const days = diffMs / (1000 * 60 * 60 * 24)
  return days / 30.437
}

function hasMeaningfulDebrief(row: {
  instructor_comments: string | null
  lesson_highlights: string | null
  areas_for_improvement: string | null
  focus_next_lesson: string | null
  safety_concerns: string | null
  airmanship: string | null
}) {
  const hasValue = (v: string | null) => typeof v === "string" && v.trim().length > 0
  return (
    hasValue(row.instructor_comments) ||
    hasValue(row.lesson_highlights) ||
    hasValue(row.areas_for_improvement) ||
    hasValue(row.focus_next_lesson) ||
    hasValue(row.safety_concerns) ||
    hasValue(row.airmanship)
  )
}

export async function GET(
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

    const enrollmentResult = await supabase
      .from("student_syllabus_enrollment")
      .select("enrolled_at, completion_date, status")
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .eq("syllabus_id", syllabusId)
      .order("enrolled_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (enrollmentResult.error) throw enrollmentResult.error

    const syllabusResult = await supabase
      .from("syllabus")
      .select("id, number_of_exams")
      .eq("tenant_id", tenantId)
      .eq("id", syllabusId)
      .maybeSingle()

    if (syllabusResult.error) throw syllabusResult.error

    const lessonsResult = await supabase
      .from("lessons")
      .select("id, name, order, is_active, is_required")
      .eq("tenant_id", tenantId)
      .eq("syllabus_id", syllabusId)
      .order("order", { ascending: true })

    if (lessonsResult.error) throw lessonsResult.error

    const progressResult = await supabase
      .from("lesson_progress")
      .select("lesson_id, status, date")
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .eq("syllabus_id", syllabusId)
      .not("lesson_id", "is", null)

    if (progressResult.error) throw progressResult.error

    const lessonAttempts = progressResult.data ?? []

    const enrolledAtIso = enrollmentResult.data?.enrolled_at ?? null
    const enrolledAtDate = asDate(enrolledAtIso)
    const firstAttemptDate =
      [...lessonAttempts]
        .map((a) => asDate(a.date))
        .filter((d): d is Date => !!d)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null
    const velocityStart = enrolledAtDate ?? firstAttemptDate

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

    const examsResult = await supabase
      .from("exam_results")
      .select("id, result, exam:exam!exam_results_exam_id_fkey(id, syllabus_id)")
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)

    if (examsResult.error) throw examsResult.error

    const passedExams = (examsResult.data ?? [])
      .filter((r) => r.exam?.syllabus_id === syllabusId)
      .filter((r) => r.result === "PASS").length
    const requiredExams = syllabusResult.data?.number_of_exams ?? 0

    const flightHoursResult = await supabase
      .from("flight_experience")
      .select("value")
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .eq("unit", "hours")

    if (flightHoursResult.error) throw flightHoursResult.error

    const flightHoursTotal = (flightHoursResult.data ?? []).reduce((acc, r) => acc + (r.value ?? 0), 0)

    const velocityMonths =
      velocityStart ? monthsBetween(velocityStart, new Date(nowIso)) : 0
    const lessonsPerMonth =
      velocityMonths > 0 ? Number((completedLessons / velocityMonths).toFixed(1)) : null

    const nextBookingResult = await supabase
      .from("bookings")
      .select(
        "id, start_time, end_time, status, lesson:lessons!bookings_lesson_id_fkey(id, name, syllabus_id), instructor:instructors!bookings_instructor_id_fkey(id, first_name, last_name, user:user_directory!instructors_user_id_fkey(first_name, last_name, email)), aircraft:aircraft!bookings_aircraft_id_fkey(registration)"
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .gte("start_time", nowIso)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true })
      .limit(10)

    if (nextBookingResult.error) throw nextBookingResult.error
    const nextBookingRow =
      (nextBookingResult.data ?? []).find((b) => b.lesson?.syllabus_id === syllabusId) ?? null

    const rawDebriefResult = await supabase
      .from("lesson_progress")
      .select(
        "id, date, instructor_comments, lesson_highlights, areas_for_improvement, focus_next_lesson, safety_concerns, airmanship, lesson:lessons!lesson_progress_lesson_id_fkey(id, name), instructor:instructors!lesson_progress_instructor_id_fkey(id, first_name, last_name, user:user_directory!instructors_user_id_fkey(first_name, last_name, email))"
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .eq("syllabus_id", syllabusId)
      .or(
        "instructor_comments.not.is.null,lesson_highlights.not.is.null,areas_for_improvement.not.is.null,focus_next_lesson.not.is.null,safety_concerns.not.is.null,airmanship.not.is.null"
      )
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (rawDebriefResult.error) throw rawDebriefResult.error

    const lastDebrief =
      rawDebriefResult.data && hasMeaningfulDebrief(rawDebriefResult.data)
        ? {
            id: rawDebriefResult.data.id,
            date: rawDebriefResult.data.date,
            lesson: rawDebriefResult.data.lesson ?? null,
            instructor: rawDebriefResult.data.instructor ?? null,
          }
        : null

    const payload: TrainingStudentOverviewResponse = {
      syllabus_id: syllabusId,
      enrolled_at: enrolledAtIso,
      completion_date: enrollmentResult.data?.completion_date ?? null,
      enrollment_status: enrollmentResult.data?.status ?? null,
      progress: { completed: completedLessons, total: totalLessons, percent },
      theory: { passed: passedExams, required: requiredExams },
      flight_hours_total: Number.isFinite(flightHoursTotal) ? flightHoursTotal : null,
      lessons_per_month: lessonsPerMonth,
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
      last_debrief: lastDebrief,
    }

    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json(
      { error: "Failed to load training overview" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
