import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchMembers } from "@/lib/members/fetch-members"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const createMemberSchema = z.strictObject({
  first_name: z.string().trim().max(100, "First name too long").nullable().optional(),
  last_name: z.string().trim().max(100, "Last name too long").nullable().optional(),
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  phone: z.string().trim().max(20, "Phone number too long").nullable().optional(),
  street_address: z.string().trim().max(200, "Street address too long").nullable().optional(),
  send_invitation: z.boolean().optional().default(false),
})

function optionalTrimmed(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET() {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  try {
    const members = await fetchMembers(supabase, tenantId)
    return noStoreJson({ members })
  } catch {
    return noStoreJson({ error: "Failed to load members" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const ctx = await getTenantStaffRouteContext(supabase)
  if (ctx.response) return ctx.response
  const { user, tenantId } = ctx.context

  const parsed = createMemberSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data
  const email = payload.email.trim().toLowerCase()

  const [memberRoleResult, existingUserResult] = await Promise.all([
    supabase
      .from("roles")
      .select("id")
      .eq("name", "member")
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle(),
  ])

  if (memberRoleResult.error || !memberRoleResult.data) {
    return noStoreJson({ error: "Unable to resolve member role" }, { status: 500 })
  }

  if (existingUserResult.error) {
    return noStoreJson({ error: "Failed to validate email" }, { status: 500 })
  }

  const memberRole = memberRoleResult.data
  const existingUser = existingUserResult.data

  let userId = existingUser?.id ?? null
  let createdUserIdForRollback: string | null = null

  if (!userId) {
    const generatedId = crypto.randomUUID()
    const { data: createdUser, error: createUserError } = await supabase
      .from("users")
      .insert({
        id: generatedId,
        email,
        first_name: optionalTrimmed(payload.first_name),
        last_name: optionalTrimmed(payload.last_name),
        phone: optionalTrimmed(payload.phone),
        street_address: optionalTrimmed(payload.street_address),
        is_active: true,
      })
      .select("id")
      .maybeSingle()

    if (createUserError || !createdUser) {
      return noStoreJson({ error: "Failed to create member profile" }, { status: 500 })
    }

    userId = createdUser.id
    createdUserIdForRollback = createdUser.id
  }

  const { data: existingTenantUser, error: existingTenantUserError } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingTenantUserError) {
    return noStoreJson({ error: "Failed to validate existing member" }, { status: 500 })
  }

  if (existingTenantUser) {
    return noStoreJson({ error: "A member with that email already exists." }, { status: 409 })
  }

  const { data: tenantMember, error: createTenantUserError } = await supabase
    .from("tenant_users")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      role_id: memberRole.id,
      is_active: true,
      granted_by: user.id,
    })
    .select("user_id")
    .maybeSingle()

  if (createTenantUserError || !tenantMember) {
    if (createdUserIdForRollback) {
      const admin = createSupabaseAdminClient()
      await admin.from("users").delete().eq("id", createdUserIdForRollback)
    }

    return noStoreJson({ error: "Failed to add member to tenant" }, { status: 500 })
  }

  return noStoreJson(
    {
      member: { id: tenantMember.user_id },
      invitation_requested: payload.send_invitation,
    },
    { status: 201 }
  )
}
