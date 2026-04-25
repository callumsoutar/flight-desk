import { getRequiredPublicAppUrl } from "@/lib/env/public-app-url"
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged"

type SendMemberAccessInvitationOptions = {
  email: string
  memberId: string
  tenantId: string
  purpose: string
}

export type SendMemberAccessInvitationResult =
  | { sent: true; invitationId: string | null }
  | { sent: false; error: string }

export async function sendMemberAccessInvitation(
  options: SendMemberAccessInvitationOptions
): Promise<SendMemberAccessInvitationResult> {
  try {
    const { email, memberId, tenantId, purpose } = options
    const appUrl = getRequiredPublicAppUrl()

    const admin = createPrivilegedSupabaseClient(purpose)
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/auth/invite/accept`,
      data: {
        tenant_id: tenantId,
        user_id: memberId,
      },
    })

    if (error) {
      return { sent: false, error: error.message ?? "Failed to send invitation" }
    }

    return { sent: true, invitationId: data?.user?.id ?? null }
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Failed to send invitation",
    }
  }
}
