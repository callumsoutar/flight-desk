import { NextRequest, NextResponse } from "next/server"

import { buildAccountStatement } from "@/lib/account-statement/build-account-statement"
import { getRequiredApiSession } from "@/lib/auth/api-session"
import { isStaffRole } from "@/lib/auth/roles"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
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

  const userIdParam = request.nextUrl.searchParams.get("user_id")
  const targetUserId = userIdParam ?? user.id
  const startDateParam = request.nextUrl.searchParams.get("start_date")
  const endDateParam = request.nextUrl.searchParams.get("end_date")

  const canViewOtherMembers = isStaffRole(role)
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const statementResult = await buildAccountStatement(supabase, {
    tenantId,
    targetUserId,
    startDate: startDateParam,
    endDate: endDateParam,
  })

  if (!statementResult.ok) {
    if (statementResult.error === "query_failed") {
      return NextResponse.json(
        { error: "Failed to load account statement" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    return NextResponse.json(
      { error: "Member not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(statementResult.data, {
    headers: { "cache-control": "no-store" },
  })
}
