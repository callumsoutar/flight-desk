import { NextResponse } from "next/server"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
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
      { error: "Only admins can resend invitations" },
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
    const { error: resendError } =
      await admin.auth.admin.inviteUserByEmail(memberUser.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/invite/accept`,
        data: {
          tenant_id: tenantId,
          user_id: memberId,
        },
      })

    if (resendError) {
      const msg = resendError.message ?? "Failed to resend invitation"
      return NextResponse.json(
        { error: msg },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    return NextResponse.json(
      { sent: true },
      { status: 200, headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to resend invitation" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
