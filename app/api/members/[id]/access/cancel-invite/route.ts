import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"

import { logError } from "@/lib/security/logger"
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params

  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

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
      return noStoreJson({ error: "Member not found or has no email" }, { status: 404 })
    }

    if (!tenantUserResult.data) {
      return noStoreJson({ error: "Member not found in tenant" }, { status: 404 })
    }

    const memberUser = memberUserResult.data

    const admin = createPrivilegedSupabaseClient("cancel pending Supabase auth invitation for tenant member")

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
      return noStoreJson({ error: "No pending invitation found for this member" }, { status: 404 })
    }

    const authUser = await admin.auth.admin.getUserById(authUserId)
    const au = authUser.data?.user
    const isPending =
      au && !au.email_confirmed_at && (au as { invited_at?: string }).invited_at

    if (!isPending) {
      return noStoreJson({ error: "Cannot cancel: member has already activated their account" }, { status: 400 })
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId)

    if (deleteError) {
      logError("[members/access] Failed to cancel invitation", {
        error: deleteError.message,
        memberId,
        authUserId,
      })
      return noStoreJson({ error: "Failed to cancel invitation" }, { status: 500 })
    }

    return noStoreJson({ cancelled: true }, { status: 200 })
  } catch {
    return noStoreJson({ error: "Failed to cancel invitation" }, { status: 500 })
  }
}
