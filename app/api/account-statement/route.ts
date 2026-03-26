import { NextRequest } from "next/server"

import { buildAccountStatement } from "@/lib/account-statement/build-account-statement"
import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { isStaffRole } from "@/lib/auth/roles"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, user, role, tenantId } = session.context

  const userIdParam = request.nextUrl.searchParams.get("user_id")
  const targetUserId = userIdParam ?? user.id
  const startDateParam = request.nextUrl.searchParams.get("start_date")
  const endDateParam = request.nextUrl.searchParams.get("end_date")

  const canViewOtherMembers = isStaffRole(role)
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 })
  }

  const statementResult = await buildAccountStatement(supabase, {
    tenantId,
    targetUserId,
    startDate: startDateParam,
    endDate: endDateParam,
  })

  if (!statementResult.ok) {
    if (statementResult.error === "query_failed") {
      return noStoreJson({ error: "Failed to load account statement" }, { status: 500 })
    }

    return noStoreJson({ error: "Member not found" }, { status: 404 })
  }

  return noStoreJson(statementResult.data)
}
