import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { isStaffRole } from "@/lib/auth/roles"
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

  const session = await getTenantScopedRouteContext({ includeRole: true })
  if (session.response) return session.response
  const { supabase, user, role, tenantId } = session.context

  const canViewOtherMembers = isStaffRole(role)
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 })
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

    return noStoreJson(payload)
  } catch {
    return noStoreJson({ error: "Failed to load training comments" }, { status: 500 })
  }
}
