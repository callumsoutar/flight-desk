import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const createMemberSchema = z.object({
  first_name: z.string().trim().max(100, "First name too long").nullable().optional(),
  last_name: z.string().trim().max(100, "Last name too long").nullable().optional(),
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  phone: z.string().trim().max(20, "Phone number too long").nullable().optional(),
  street_address: z.string().trim().max(200, "Street address too long").nullable().optional(),
  send_invitation: z.boolean().optional().default(false),
})

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

function optionalTrimmed(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }
  if (!isStaff(role)) {
    return NextResponse.json(
      { error: "Only staff can add members" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const parsed = createMemberSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const payload = parsed.data
  const email = payload.email.trim().toLowerCase()

  const { data: memberRole, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "member")
    .eq("is_active", true)
    .maybeSingle()

  if (roleError || !memberRole) {
    return NextResponse.json(
      { error: "Unable to resolve member role" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: existingUser, error: existingUserError } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (existingUserError) {
    return NextResponse.json(
      { error: "Failed to validate email" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  let userId = existingUser?.id ?? null

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
      return NextResponse.json(
        { error: "Failed to create member profile" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    userId = createdUser.id
  }

  const { data: existingTenantUser, error: existingTenantUserError } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingTenantUserError) {
    return NextResponse.json(
      { error: "Failed to validate existing member" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  if (existingTenantUser) {
    return NextResponse.json(
      { error: "A member with that email already exists." },
      { status: 409, headers: { "cache-control": "no-store" } }
    )
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
    return NextResponse.json(
      { error: "Failed to add member to tenant" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    {
      member: { id: tenantMember.user_id },
      invitation_requested: payload.send_invitation,
    },
    { status: 201, headers: { "cache-control": "no-store" } }
  )
}
