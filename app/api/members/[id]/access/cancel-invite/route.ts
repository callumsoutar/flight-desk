import { NextResponse } from "next/server"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { logError } from "@/lib/security/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user || !tenantId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }

  if (!isAdminRole(role)) {
    return NextResponse.json(
      { error: "Only admins can cancel invitations" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const [memberUserResult, tenantUserResult] = await Promise.all([
      supabase
        .from("users")
        .select("id, email")
        .eq("id", memberId)
        .maybeSingle(),
      supabase
        .from("tenant_users")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", memberId)
        .maybeSingle(),
    ])

    if (memberUserResult.error || !memberUserResult.data?.email) {
      return NextResponse.json(
        { error: "Member not found or has no email" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }

    if (!tenantUserResult.data) {
      return NextResponse.json(
        { error: "Member not found in tenant" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }

    const memberUser = memberUserResult.data

    const admin = createSupabaseAdminClient()

    let authUserId: string | null = null
    const byId = await admin.auth.admin.getUserById(memberId)
    if (byId.data?.user) {
      authUserId = byId.data.user.id
    } else {
      const { data: listData } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })
      const found = listData.users.find(
        (u) => u.email?.toLowerCase() === memberUser.email.toLowerCase()
      )
      authUserId = found?.id ?? null
    }

    if (!authUserId) {
      return NextResponse.json(
        { error: "No pending invitation found for this member" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }

    const authUser = await admin.auth.admin.getUserById(authUserId)
    const au = authUser.data?.user
    const isPending =
      au && !au.email_confirmed_at && (au as { invited_at?: string }).invited_at

    if (!isPending) {
      return NextResponse.json(
        { error: "Cannot cancel: member has already activated their account" },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId)

    if (deleteError) {
      logError("[members/access] Failed to cancel invitation", {
        error: deleteError.message,
        memberId,
        authUserId,
      })
      return NextResponse.json(
        { error: "Failed to cancel invitation" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    return NextResponse.json(
      { cancelled: true },
      { status: 200, headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to cancel invitation" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
