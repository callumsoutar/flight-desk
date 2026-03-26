import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"

import { getRequiredPublicAppUrl } from "@/lib/env/public-app-url"
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
    const appUrl = getRequiredPublicAppUrl()

    const admin = createPrivilegedSupabaseClient("resend Supabase auth invitation for existing tenant member")
    const { error: resendError } =
      await admin.auth.admin.inviteUserByEmail(memberUser.email, {
        redirectTo: `${appUrl}/auth/invite/accept`,
        data: {
          tenant_id: tenantId,
          user_id: memberId,
        },
      })

    if (resendError) {
      const msg = resendError.message ?? "Failed to resend invitation"
      return noStoreJson({ error: msg }, { status: 400 })
    }

    return noStoreJson({ sent: true }, { status: 200 })
  } catch {
    return noStoreJson({ error: "Failed to resend invitation" }, { status: 500 })
  }
}
