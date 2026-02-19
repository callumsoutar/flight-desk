import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { MemberTrainingCommentsResponse } from "@/lib/types/member-training"

export const dynamic = "force-dynamic"

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
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

  const canViewOtherMembers = role === "owner" || role === "admin" || role === "instructor"
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const offset = parsePositiveInt(request.nextUrl.searchParams.get("offset"), 0)
  const limit = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("limit"), 5) || 5, 50)

  try {
    const { data, error } = await supabase
      .from("lesson_progress")
      .select(
        "id, date, instructor_comments, booking_id, booking:bookings!lesson_progress_booking_id_fkey(aircraft:aircraft!bookings_aircraft_id_fkey(registration)), instructor:instructors!lesson_progress_instructor_id_fkey(user:user_directory!instructors_user_id_fkey(first_name, last_name))"
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .not("instructor_comments", "is", null)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const comments = (data ?? []).filter((row) => {
      if (typeof row.instructor_comments !== "string") return false
      return row.instructor_comments.trim().length > 0
    })

    const hasMore = (data ?? []).length === limit
    const payload: MemberTrainingCommentsResponse = {
      comments,
      has_more: hasMore,
      next_offset: hasMore ? offset + limit : null,
    }

    return NextResponse.json(payload, {
      headers: { "cache-control": "no-store" },
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to load training comments" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
