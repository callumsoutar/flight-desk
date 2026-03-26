import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"

import { isStaffRole } from "@/lib/auth/roles"
import { fetchMemberContactDetails } from "@/lib/members/fetch-member-contact-details"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params

  const session = await getTenantScopedRouteContext({ includeRole: true })
  if (session.response) return session.response
  const { supabase, user, role, tenantId } = session.context

  const isStaff = isStaffRole(role)
  const isOwn = user.id === memberId
  if (!isStaff && !isOwn) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const details = await fetchMemberContactDetails(supabase, tenantId, memberId)
    if (!details) {
      return noStoreJson({ error: "Member not found" }, { status: 404 })
    }

    return noStoreJson(details)
  } catch {
    return noStoreJson({ error: "Failed to load contact details" }, { status: 500 })
  }
}
