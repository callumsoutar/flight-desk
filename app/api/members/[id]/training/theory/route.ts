import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { TrainingTheoryResponse, TrainingTheoryRow } from "@/lib/types/training-theory"

export const dynamic = "force-dynamic"

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

function cleanSyllabusId(value: string | null) {
  const v = (value ?? "").trim()
  if (!v || v === "all") return null
  return v
}

type ExamRow = {
  id: string
  name: string
  passing_score: number
}

type ExamResultRow = {
  exam_id: string
  exam_date: string
  result: "PASS" | "FAIL"
  score: number | null
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
    const examsResult = await supabase
      .from("exam")
      .select("id, name, passing_score")
      .eq("tenant_id", tenantId)
      .eq("syllabus_id", syllabusId)
      .eq("is_active", true)
      .is("voided_at", null)
      .order("name", { ascending: true })

    if (examsResult.error) throw examsResult.error
    const exams = (examsResult.data ?? []) as ExamRow[]

    if (exams.length === 0) {
      const payload: TrainingTheoryResponse = { rows: [] }
      return NextResponse.json(payload, { headers: { "cache-control": "no-store" } })
    }

    const examIds = exams.map((e) => e.id)

    const resultsResult = await supabase
      .from("exam_results")
      .select("exam_id, exam_date, result, score")
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .in("exam_id", examIds)
      .order("exam_date", { ascending: false })
      .order("created_at", { ascending: false })

    if (resultsResult.error) throw resultsResult.error
    const results = (resultsResult.data ?? []) as ExamResultRow[]

    const grouped = new Map<string, ExamResultRow[]>()
    for (const r of results) {
      if (!grouped.has(r.exam_id)) grouped.set(r.exam_id, [])
      grouped.get(r.exam_id)!.push(r)
    }

    const rows: TrainingTheoryRow[] = exams.map((exam) => {
      const attempts = grouped.get(exam.id) ?? []

      const bestScore = attempts.reduce<number | null>((acc, r) => {
        const score = typeof r.score === "number" ? r.score : null
        if (score === null) return acc
        if (acc === null) return score
        return Math.max(acc, score)
      }, null)

      if (attempts.length === 0) {
        return {
          exam_id: exam.id,
          exam_name: exam.name,
          passing_score: exam.passing_score,
          attempts: 0,
          status: "not_attempted",
          score: null,
          exam_date: null,
          best_score: null,
        }
      }

      const passAttempt = attempts.find((a) => a.result === "PASS") ?? null
      const source = passAttempt ?? attempts[0]

      return {
        exam_id: exam.id,
        exam_name: exam.name,
        passing_score: exam.passing_score,
        attempts: attempts.length,
        status: passAttempt ? "passed" : "not_passed",
        score: source.score ?? null,
        exam_date: source.exam_date ?? null,
        best_score: bestScore,
      }
    })

    const payload: TrainingTheoryResponse = { rows }
    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json(
      { error: "Failed to load theory results" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

