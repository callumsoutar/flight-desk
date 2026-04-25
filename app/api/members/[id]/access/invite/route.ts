import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"

import { sendMemberAccessInvitation } from "@/lib/members/send-access-invitation"

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

    const inviteResult = await sendMemberAccessInvitation({
      email: memberUserResult.data.email,
      memberId,
      tenantId,
      purpose: "issue Supabase auth invitation for existing tenant member",
    })

    if (!inviteResult.sent) {
      return noStoreJson({ error: inviteResult.error }, { status: 400 })
    }

    return noStoreJson(
      {
        sent: true,
        invitation_id: inviteResult.invitationId,
      },
      { status: 200 }
    )
  } catch {
    return noStoreJson({ error: "Failed to send invitation" }, { status: 500 })
  }
}
