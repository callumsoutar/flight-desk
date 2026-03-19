import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { UserRole } from "@/lib/types/roles"
import type { Database } from "@/lib/types"
import type {
  TrainingActivityStatus,
  TrainingOverviewResponse,
  TrainingOverviewRow,
} from "@/lib/types/training-overview"

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items]
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

function safeDaysSince(value: string): number {
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return 0
  const now = Date.now()
  const diffMs = Math.max(0, now - dt.getTime())
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function activityStatusFor({
  lastFlightAt,
  daysSinceLastFlight,
  daysSinceEnrolled,
}: {
  lastFlightAt: string | null
  daysSinceLastFlight: number | null
  daysSinceEnrolled: number
}): TrainingActivityStatus {
  if (!lastFlightAt || daysSinceLastFlight === null) {
    return daysSinceEnrolled <= 30 ? "new" : "stale"
  }

  if (daysSinceLastFlight <= 30) return "active"
  if (daysSinceLastFlight <= 60) return "at_risk"
  return "stale"
}

export async function fetchTrainingOverview(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string,
  role: UserRole
): Promise<TrainingOverviewResponse> {
  let instructorId: string | null = null
  if (role === "instructor") {
    const { data, error } = await supabase
      .from("instructors")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle()

    if (!error && data?.id) instructorId = data.id
    if (!instructorId) {
      return { generated_at: new Date().toISOString(), syllabi: [], rows: [] }
    }
  }

  const enrollmentsQuery = supabase
    .from("student_syllabus_enrollment")
    .select(
      `
      id,
      enrolled_at,
      completion_date,
      status,
      user_id,
      syllabus_id,
      primary_instructor_id,
      student:user_directory!student_syllabus_enrollment_user_id_fkey(id, first_name, last_name, email),
      syllabus:syllabus!student_syllabus_enrollment_syllabus_id_fkey(id, name)
    `
    )
    .eq("tenant_id", tenantId)

  let scopedEnrollmentsQuery = enrollmentsQuery
  if (role === "instructor") {
    if (!instructorId) {
      return { generated_at: new Date().toISOString(), syllabi: [], rows: [] }
    }
    scopedEnrollmentsQuery = scopedEnrollmentsQuery.eq("primary_instructor_id", instructorId)
  }

  const { data: enrollmentRows, error: enrollmentError } = await scopedEnrollmentsQuery

  if (enrollmentError) throw enrollmentError

  const enrollments = (enrollmentRows ?? []).map((row) => ({
    enrollment_id: row.id as string,
    enrolled_at: row.enrolled_at as string,
    completion_date: (row.completion_date as string | null) ?? null,
    enrollment_status: (row.status as string) ?? "",
    user_id: row.user_id as string,
    syllabus_id: row.syllabus_id as string,
    primary_instructor_id: (row.primary_instructor_id as string | null) ?? null,
    student: row.student as {
      id: string | null
      first_name: string | null
      last_name: string | null
      email: string | null
    } | null,
    syllabus: row.syllabus as { id: string; name: string } | null,
  }))

  const syllabusById = new Map<string, { id: string; name: string }>()
  for (const e of enrollments) {
    if (e.syllabus?.id) syllabusById.set(e.syllabus.id, e.syllabus)
  }

  const syllabi = [...syllabusById.values()].sort((a, b) => a.name.localeCompare(b.name))
  const syllabusIds = syllabi.map((s) => s.id)
  const studentIds = [...new Set(enrollments.map((e) => e.user_id))].filter(Boolean)
  const primaryInstructorIds = [
    ...new Set(enrollments.map((e) => e.primary_instructor_id).filter(Boolean)),
  ] as string[]

  const primaryInstructorById = new Map<
    string,
    { id: string; first_name: string | null; last_name: string | null; user_id: string }
  >()
  const lessonsTotalBySyllabusId = new Map<string, number>()
  const [instructorsResult, lessonsResult] = await Promise.all([
    primaryInstructorIds.length
      ? supabase
          .from("instructors")
          .select(
            "id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(first_name, last_name)"
          )
          .eq("tenant_id", tenantId)
          .in("id", primaryInstructorIds)
      : Promise.resolve({ data: null, error: null }),
    syllabusIds.length
      ? supabase
          .from("lessons")
          .select("id, syllabus_id, is_active, is_required")
          .eq("tenant_id", tenantId)
          .in("syllabus_id", syllabusIds)
      : Promise.resolve({ data: null, error: null }),
  ])

  if (instructorsResult.error) throw instructorsResult.error
  if (lessonsResult.error) throw lessonsResult.error

  for (const i of instructorsResult.data ?? []) {
    const user = (i as unknown as { user: { first_name: string | null; last_name: string | null } | null }).user
    primaryInstructorById.set(i.id, {
      id: i.id,
      first_name: user?.first_name ?? i.first_name,
      last_name: user?.last_name ?? i.last_name,
      user_id: i.user_id,
    })
  }

  for (const lesson of lessonsResult.data ?? []) {
    if (!lesson.syllabus_id) continue
    if (!lesson.is_active) continue
    if (lesson.is_required === false) continue
    lessonsTotalBySyllabusId.set(
      lesson.syllabus_id,
      (lessonsTotalBySyllabusId.get(lesson.syllabus_id) ?? 0) + 1
    )
  }

  const progressMap = new Map<
    string,
    { passedLessonIds: Set<string>; lastDateMs: number | null; lastDate: string | null }
  >()

  if (studentIds.length && syllabusIds.length) {
    const syllabusChunks = chunk(syllabusIds, 200)
    const studentChunks = chunk(studentIds, 200)

    for (const userChunk of studentChunks) {
      for (const syllabusChunk of syllabusChunks) {
        const { data: progressRows, error } = await supabase
          .from("lesson_progress")
          .select("user_id, syllabus_id, lesson_id, status, date")
          .eq("tenant_id", tenantId)
          .in("user_id", userChunk)
          .in("syllabus_id", syllabusChunk)

        if (error) throw error

        for (const p of progressRows ?? []) {
          if (!p.user_id || !p.syllabus_id) continue
          const key = `${p.user_id}|${p.syllabus_id}`
          const existing =
            progressMap.get(key) ??
            { passedLessonIds: new Set<string>(), lastDateMs: null, lastDate: null }

          const dateMs = new Date(p.date).getTime()
          if (!Number.isNaN(dateMs)) {
            if (existing.lastDateMs === null || dateMs > existing.lastDateMs) {
              existing.lastDateMs = dateMs
              existing.lastDate = p.date
            }
          }

          if (p.status === "pass" && p.lesson_id) existing.passedLessonIds.add(p.lesson_id)
          progressMap.set(key, existing)
        }
      }
    }
  }

  const rows: TrainingOverviewRow[] = enrollments
    .filter((e) => !!e.student?.id && !!e.syllabus?.id)
    .map((e): TrainingOverviewRow => {
      const key = `${e.user_id}|${e.syllabus_id}`
      const progress = progressMap.get(key) ?? {
        passedLessonIds: new Set<string>(),
        lastDate: null,
        lastDateMs: null,
      }

      const totalLessons = lessonsTotalBySyllabusId.get(e.syllabus_id) ?? 0
      const completedLessons = progress.passedLessonIds.size
      const percent =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : null

      const daysSinceEnrolled = safeDaysSince(e.enrolled_at)
      const daysSinceLastFlight = progress.lastDate ? safeDaysSince(progress.lastDate) : null

      const activity_status = activityStatusFor({
        lastFlightAt: progress.lastDate,
        daysSinceLastFlight,
        daysSinceEnrolled,
      })

      const syllabus = syllabusById.get(e.syllabus_id) ?? { id: e.syllabus_id, name: "Syllabus" }
      const student = {
        id: e.student?.id ?? e.user_id,
        first_name: e.student?.first_name ?? null,
        last_name: e.student?.last_name ?? null,
        email: e.student?.email ?? null,
      }

      const primaryInstructor =
        e.primary_instructor_id ? primaryInstructorById.get(e.primary_instructor_id) ?? null : null

      return {
        enrollment_id: e.enrollment_id,
        enrolled_at: e.enrolled_at,
        completion_date: e.completion_date,
        enrollment_status: e.enrollment_status,
        user_id: e.user_id,
        syllabus_id: e.syllabus_id,
        primary_instructor_id: e.primary_instructor_id,
        student,
        syllabus,
        primaryInstructor,
        last_flight_at: progress.lastDate,
        days_since_last_flight: daysSinceLastFlight,
        days_since_enrolled: daysSinceEnrolled,
        progress: { completed: completedLessons, total: totalLessons, percent },
        activity_status,
      }
    })

  rows.sort((a, b) => {
    const an = `${a.student.last_name ?? ""} ${a.student.first_name ?? ""}`.trim()
    const bn = `${b.student.last_name ?? ""} ${b.student.first_name ?? ""}`.trim()
    return an.localeCompare(bn)
  })

  return {
    generated_at: new Date().toISOString(),
    syllabi,
    rows,
  }
}
