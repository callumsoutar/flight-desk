import type { SupabaseClient, User } from "@supabase/supabase-js"

import { claimsRoleToUserRole, isUserRole } from "@/lib/auth/roles"
import type { Database } from "@/lib/types"
import type { UserRole } from "@/lib/types/roles"

export type JwtClaims = {
  sub?: string
  role?: string
  [key: string]: unknown
}

export type AuthSession = {
  user: User | null
  claims: JwtClaims | null
  role: UserRole | null
}

async function resolveRoleFromDatabase(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserRole | null> {
  const { data, error } = await supabase.rpc("get_tenant_user_role", {
    p_user_id: userId,
  })

  if (error) return null
  return isUserRole(data) ? data : null
}

export async function getAuthSession(
  supabase: SupabaseClient<Database>
): Promise<AuthSession> {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const claims = claimsError
    ? null
    : ((claimsData?.claims ?? null) as JwtClaims | null)

  const claimedUserId =
    typeof claims?.sub === "string" && claims.sub ? claims.sub : null

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user ?? null
  if (userError || !user) {
    return { user: null, claims: null, role: null }
  }

  if (claimedUserId && claimedUserId !== user.id) {
    return { user: null, claims: null, role: null }
  }

  let role = claimsRoleToUserRole(claims?.role)
  if (!role) {
    role = await resolveRoleFromDatabase(supabase, user.id)
  }

  return { user, claims, role }
}
