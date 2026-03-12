import { NextRequest, NextResponse } from "next/server"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { TrainingFlyingResponse, TrainingLessonStatus } from "@/lib/types/training-flying"

export const dynamic = "force-dynamic"

function cleanSyllabusId(value: string | null) {
  const v = (value ?? "").trim()
  if (!v || v === "all") return null
  return v
}

function resolveLessonStatus(attempts: { status: string | null }[]): TrainingLessonStatus {
  if (!attempts.length) return "not_started"
  if (attempts.some((a) => a.status === "pass")) return "completed"
  const latest = attempts[0]?.status ?? null
  if (latest === "not yet competent") return "needs_repeat"
  return "in_progress"
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
    const [lessonsResult, progressResult] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, name, order, is_active")
        .eq("tenant_id", tenantId)
        .eq("syllabus_id", syllabusId)
        .order("order", { ascending: true }),
      supabase
        .from("lesson_progress")
        .select(
          "id, lesson_id, date, completed_at, attempt, status, booking_id, instructor_comments, instructor:instructors!lesson_progress_instructor_id_fkey(id, first_name, last_name, user:user_directory!instructors_user_id_fkey(first_name, last_name, email))"
        )
        .eq("tenant_id", tenantId)
        .eq("user_id", targetUserId)
        .eq("syllabus_id", syllabusId)
        .not("lesson_id", "is", null)
        .order("date", { ascending: false }),
    ])

    if (lessonsResult.error) throw lessonsResult.error
    if (progressResult.error) throw progressResult.error

    const lessons = (lessonsResult.data ?? []).filter((l) => l.is_active !== false)

    const attemptsByLessonId = new Map<string, (typeof progressResult.data)[number][]>()
    for (const row of progressResult.data ?? []) {
      if (!row.lesson_id) continue
      const list = attemptsByLessonId.get(row.lesson_id) ?? []
      list.push(row)
      attemptsByLessonId.set(row.lesson_id, list)
    }

    const computed = lessons.map((lesson) => {
      const attempts = attemptsByLessonId.get(lesson.id) ?? []
      const status = resolveLessonStatus(attempts)
      const latestAttempt = attempts.length ? attempts[0] : null
      const attemptsCount =
        attempts.reduce((acc, a) => Math.max(acc, typeof a.attempt === "number" ? a.attempt : 0), 0) ||
        attempts.length

      const completedAtCandidate =
        attempts.find((a) => a.status === "pass")?.completed_at ??
        attempts.find((a) => a.status === "pass")?.date ??
        null

      return {
        lesson: {
          id: lesson.id,
          name: lesson.name,
          order: lesson.order,
        },
        status,
        attempts: attemptsCount,
        latest_attempt: latestAttempt,
        completed_at: status === "completed" ? completedAtCandidate : null,
      }
    })

    const payload: TrainingFlyingResponse = {
      syllabus_id: syllabusId,
      lessons: computed,
    }

    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json(
      { error: "Failed to load flying lessons" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

