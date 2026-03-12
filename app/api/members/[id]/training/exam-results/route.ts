import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { zonedTodayYyyyMmDd } from "@/lib/utils/timezone"

export const dynamic = "force-dynamic"

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const createExamResultSchema = z.object({
  exam_id: z.string().min(1),
  result: z.enum(["PASS", "FAIL"]),
  score: z.number().min(0).max(100).nullable().optional(),
  exam_date: dateKeySchema.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
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
  const parsed = createExamResultSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .maybeSingle()

  if (tenantError) {
    return NextResponse.json(
      { error: "Failed to resolve tenant settings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  const timeZone = tenant?.timezone ?? "Pacific/Auckland"
  const examDate = parsed.data.exam_date ?? zonedTodayYyyyMmDd(timeZone)
  const score = parsed.data.score ?? 0

  const { data: exam } = await supabase
    .from("exam")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", parsed.data.exam_id)
    .eq("is_active", true)
    .is("voided_at", null)
    .maybeSingle()

  if (!exam) {
    return NextResponse.json(
      { error: "Selected exam was not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  const { data, error } = await supabase
    .from("exam_results")
    .insert({
      tenant_id: tenantId,
      user_id: targetUserId,
      exam_id: parsed.data.exam_id,
      exam_date: examDate,
      result: parsed.data.result,
      score,
      notes: parsed.data.notes ?? null,
    })
    .select(
      "id, exam_id, exam_date, result, score, notes, exam:exam!exam_results_exam_id_fkey(id, name, passing_score, syllabus_id, syllabus:syllabus!exam_syllabus_id_fkey(id, name))"
    )
    .single()

  if (error) {
    return NextResponse.json(
      { error: "Failed to log exam result" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { result: data },
    { status: 201, headers: { "cache-control": "no-store" } }
  )
}

