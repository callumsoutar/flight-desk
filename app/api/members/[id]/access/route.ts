import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getRequiredApiSession } from "@/lib/auth/api-session"
import { isAdminRole, isStaffRole } from "@/lib/auth/roles"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export type MemberAccessStatus = "active" | "pending_invite" | "not_invited"

export type MemberAccessResponse = {
  portal_status: MemberAccessStatus
  invite_status: "none" | "pending" | "accepted"
  account_created: boolean
  roles: { id: string; name: string }[]
  current_role: { id: string; name: string } | null
  email: string | null
  invited_at: string | null
}

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

  if (!isStaffRole(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const [memberUserResult, tenantUserResult, allRolesResult] = await Promise.all([
      supabase
        .from("users")
        .select("id, email")
        .eq("id", memberId)
        .maybeSingle(),
      supabase
        .from("tenant_users")
        .select("role:roles!tenant_users_role_id_fkey(id, name)")
        .eq("tenant_id", tenantId)
        .eq("user_id", memberId)
        .maybeSingle(),
      supabase
        .from("roles")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
    ])

    if (memberUserResult.error || !memberUserResult.data) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }

    if (tenantUserResult.error || !tenantUserResult.data) {
      return NextResponse.json(
        { error: "Member not found in tenant" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }

    const memberUser = memberUserResult.data
    const tenantUser = tenantUserResult.data
    const allRoles = allRolesResult.data

    const currentRole = Array.isArray(tenantUser.role)
      ? tenantUser.role[0]
      : tenantUser.role

    let portal_status: MemberAccessStatus = "not_invited"
    let invite_status: "none" | "pending" | "accepted" = "none"
    let account_created = false
    let invited_at: string | null = null

    const admin = createSupabaseAdminClient()
    const email = memberUser.email ?? null

    if (email) {
      type AuthUserShape = {
        email_confirmed_at?: string | null
        invited_at?: string | null
      }

      let authUser: AuthUserShape | null = null

      const byId = await admin.auth.admin.getUserById(memberId)
      if (byId.data?.user) {
        authUser = byId.data.user as AuthUserShape
      } else {
        const { data: listData } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        })
        const found = listData.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        )
        authUser = found ? (found as AuthUserShape) : null
      }

      if (authUser) {
        account_created = true
        const confirmed = Boolean(authUser.email_confirmed_at)
        const invited = Boolean(authUser.invited_at)

        if (invited && !confirmed) {
          portal_status = "pending_invite"
          invite_status = "pending"
          invited_at = authUser.invited_at ?? null
        } else {
          portal_status = "active"
          invite_status = confirmed ? "accepted" : "pending"
        }
      }
    }

    const response: MemberAccessResponse = {
      portal_status,
      invite_status,
      account_created,
      roles: (allRoles ?? []).map((r) => ({ id: r.id, name: r.name })),
      current_role: currentRole
        ? { id: (currentRole as { id: string }).id, name: (currentRole as { name: string }).name }
        : null,
      email,
      invited_at,
    }

    return NextResponse.json(response, {
      headers: { "cache-control": "no-store" },
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to load access status" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

const updateRoleSchema = z.strictObject({
  role_id: z.string().uuid(),
})

export async function PATCH(
  request: NextRequest,
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

  if (!isAdminRole(role)) {
    return NextResponse.json(
      { error: "Only admins can update member roles" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = updateRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const { data: roleRow, error: roleError } = await supabase
      .from("roles")
      .select("id")
      .eq("id", parsed.data.role_id)
      .eq("is_active", true)
      .maybeSingle()

    if (roleError || !roleRow) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    const { error: updateError } = await supabase
      .from("tenant_users")
      .update({ role_id: parsed.data.role_id })
      .eq("tenant_id", tenantId)
      .eq("user_id", memberId)

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update role" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    return NextResponse.json(
      { updated: true, role_id: parsed.data.role_id },
      { status: 200, headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
