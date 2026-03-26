import { NextResponse } from "next/server"

import { getRequiredApiSession } from "@/lib/auth/api-session"
import { isStaffRole } from "@/lib/auth/roles"
import { fetchMemberContactDetails } from "@/lib/members/fetch-member-contact-details"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getRequiredApiSession(supabase, {
    includeRole: true,
  })

  if (!user || !tenantId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }

  const isStaff = isStaffRole(role)
  const isOwn = user.id === memberId
  if (!isStaff && !isOwn) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const details = await fetchMemberContactDetails(supabase, tenantId, memberId)
    if (!details) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }

    return NextResponse.json(details, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json(
      { error: "Failed to load contact details" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
