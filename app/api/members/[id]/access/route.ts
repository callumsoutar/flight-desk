import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { isMemberOrStudentRole, isUserRole } from "@/lib/auth/roles"
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types/roles"

export const dynamic = "force-dynamic"

export type MemberAccessStatus = "active" | "pending_invite" | "not_invited"

export type MemberAccessResponse = {
  portal_status: MemberAccessStatus
  invite_status: "none" | "pending" | "accepted"
  account_created: boolean
  /** When true, member/student users cannot use the portal (UI must reflect even if auth shows active). */
  is_restricted_login: boolean
  can_toggle_restricted_login: boolean
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
  const session = await getTenantScopedRouteContext({
    access: "staff",
    existingSupabase: supabase,
  })
  if (session.response) return session.response
  const { tenantId } = session.context

  try {
    const [memberUserResult, tenantUserResult, allRolesResult] = await Promise.all([
      supabase
        .from("users")
        .select("id, email")
        .eq("id", memberId)
        .maybeSingle(),
      supabase
        .from("tenant_users")
        .select("is_restricted_login, role:roles!tenant_users_role_id_fkey(id, name)")
        .eq("tenant_id", tenantId)
        .eq("user_id", memberId)
        .maybeSingle(),
      supabase
        .from("roles")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
    ])

    if (memberUserResult.error) {
      return noStoreJson({ error: "Failed to load user" }, { status: 500 })
    }
    if (!memberUserResult.data) {
      return noStoreJson({ error: "Member not found" }, { status: 404 })
    }

    if (tenantUserResult.error) {
      return noStoreJson(
        { error: "Failed to load tenant membership" },
        { status: 500 }
      )
    }
    if (!tenantUserResult.data) {
      return noStoreJson({ error: "Member not found in tenant" }, { status: 404 })
    }

    const memberUser = memberUserResult.data
    const tenantUser = tenantUserResult.data
    const allRoles = allRolesResult.data

    const currentRole = Array.isArray(tenantUser.role)
      ? tenantUser.role[0]
      : tenantUser.role
    const roleNameRaw = currentRole ? (currentRole as { name: string }).name : ""
    const roleNorm = roleNameRaw ? roleNameRaw.toLowerCase() : ""
    const isRestrictedLogin = Boolean(tenantUser.is_restricted_login)
    const canToggleRestricted =
      isUserRole(roleNorm) && isMemberOrStudentRole(roleNorm as UserRole)

    let portal_status: MemberAccessStatus = "not_invited"
    let invite_status: "none" | "pending" | "accepted" = "none"
    let account_created = false
    let invited_at: string | null = null

    const admin = createPrivilegedSupabaseClient("read auth-user invitation status for member access visibility")
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
      is_restricted_login: isRestrictedLogin,
      can_toggle_restricted_login: canToggleRestricted,
      roles: (allRoles ?? []).map((r) => ({ id: r.id, name: r.name })),
      current_role: currentRole
        ? { id: (currentRole as { id: string }).id, name: (currentRole as { name: string }).name }
        : null,
      email,
      invited_at,
    }

    return noStoreJson(response)
  } catch {
    return noStoreJson({ error: "Failed to load access status" }, { status: 500 })
  }
}

const patchAccessSchema = z
  .object({
    role_id: z.string().uuid().optional(),
    is_restricted_login: z.boolean().optional(),
  })
  .refine(
    (b) => b.role_id !== undefined || b.is_restricted_login !== undefined,
    { message: "At least one of role_id or is_restricted_login is required" }
  )

function targetRoleNameFromTenantUser(
  data: { role: unknown } | null
): string {
  if (!data?.role) return ""
  const r = data.role
  const one = Array.isArray(r) ? r[0] : r
  if (!one || typeof one !== "object" || !("name" in one)) return ""
  const n = (one as { name: string }).name
  return typeof n === "string" ? n.toLowerCase() : ""
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params

  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const body = await request.json().catch(() => null)
  const parsed = patchAccessSchema.safeParse(body)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid request body" }, { status: 400 })
  }

  const { role_id: roleId, is_restricted_login: restricted } = parsed.data

  try {
    if (restricted !== undefined) {
      const { data: targetTu, error: targetErr } = await supabase
        .from("tenant_users")
        .select("role:roles!tenant_users_role_id_fkey(name)")
        .eq("tenant_id", tenantId)
        .eq("user_id", memberId)
        .maybeSingle()

      if (targetErr || !targetTu) {
        return noStoreJson({ error: "Member not found in tenant" }, { status: 404 })
      }

      const targetRoleName = targetRoleNameFromTenantUser(targetTu)
      if (!isUserRole(targetRoleName) || !isMemberOrStudentRole(targetRoleName as UserRole)) {
        return noStoreJson(
          {
            error:
              "Portal login restriction can only be changed for members and students. Change the role first if needed.",
          },
          { status: 400 }
        )
      }

      const { error: restrictErr } = await supabase
        .from("tenant_users")
        .update({ is_restricted_login: restricted })
        .eq("tenant_id", tenantId)
        .eq("user_id", memberId)

      if (restrictErr) {
        return noStoreJson({ error: "Failed to update portal access" }, { status: 500 })
      }
    }

    if (roleId) {
      const { data: roleRow, error: roleError } = await supabase
        .from("roles")
        .select("id")
        .eq("id", roleId)
        .eq("is_active", true)
        .maybeSingle()

      if (roleError || !roleRow) {
        return noStoreJson({ error: "Invalid role" }, { status: 400 })
      }

      const { error: updateError } = await supabase
        .from("tenant_users")
        .update({ role_id: roleId })
        .eq("tenant_id", tenantId)
        .eq("user_id", memberId)

      if (updateError) {
        return noStoreJson({ error: "Failed to update role" }, { status: 500 })
      }
    }

    return noStoreJson(
      { updated: true, role_id: roleId ?? null, is_restricted_login: restricted },
      { status: 200 }
    )
  } catch {
    return noStoreJson({ error: "Failed to update access" }, { status: 500 })
  }
}
