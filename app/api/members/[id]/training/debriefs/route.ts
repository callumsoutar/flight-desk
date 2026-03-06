import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { TrainingDebriefsResponse } from "@/lib/types/training-debriefs"

export const dynamic = "force-dynamic"

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

function cleanSyllabusId(value: string | null) {
  const v = (value ?? "").trim()
  if (!v || v === "all") return null
  return v
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

  const offset = parsePositiveInt(request.nextUrl.searchParams.get("offset"), 0)
  const limit = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("limit"), 10) || 10, 50)
  const syllabusId = cleanSyllabusId(request.nextUrl.searchParams.get("syllabus_id"))

  try {
    let query = supabase
      .from("lesson_progress")
      .select(
        "id, date, status, syllabus_id, instructor_comments, lesson_highlights, areas_for_improvement, focus_next_lesson, airmanship, safety_concerns, booking_id, lesson:lessons!lesson_progress_lesson_id_fkey(id, name), instructor:instructors!lesson_progress_instructor_id_fkey(id, first_name, last_name, user_id, user:user_directory!instructors_user_id_fkey(first_name, last_name, email)), booking:bookings!lesson_progress_booking_id_fkey(aircraft:aircraft!bookings_aircraft_id_fkey(registration))"
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1)

    if (syllabusId) query = query.eq("syllabus_id", syllabusId)

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []).filter((row) => {
      const hasValue = (value: unknown) => typeof value === "string" && value.trim().length > 0
      return (
        hasValue(row.instructor_comments) ||
        hasValue(row.lesson_highlights) ||
        hasValue(row.areas_for_improvement) ||
        hasValue(row.focus_next_lesson) ||
        hasValue(row.safety_concerns) ||
        hasValue(row.airmanship)
      )
    })

    const hasMore = (data ?? []).length === limit
    const payload: TrainingDebriefsResponse = {
      debriefs: rows,
      has_more: hasMore,
      next_offset: hasMore ? offset + limit : null,
    }

    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json(
      { error: "Failed to load training debriefs" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

