import type { SupabaseClient } from "@supabase/supabase-js"

import type { JwtClaims } from "@/lib/auth/session"
import {
  claimsRoleToUserRole,
  isMemberOrStudentRole,
  isStaffRole,
  isUserRole,
} from "@/lib/auth/roles"
import type { Database } from "@/lib/types"
import type { UserRole } from "@/lib/types/roles"

export const PORTAL_ACCESS_DISABLED = "PORTAL_ACCESS_DISABLED" as const

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  return value as Record<string, unknown>
}

function asStringClaim(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function resolveRoleFromClaims(claims: JwtClaims): UserRole | null {
  const appMetadata = asRecord(claims.app_metadata)
  return (
    claimsRoleToUserRole(claims.app_role) ??
    claimsRoleToUserRole(claims.role) ??
    claimsRoleToUserRole(appMetadata?.app_role) ??
    claimsRoleToUserRole(appMetadata?.role) ??
    null
  )
}

function resolveTenantIdFromClaims(claims: JwtClaims | null | undefined): string | null {
  if (!claims) return null
  const appMetadata = asRecord(claims.app_metadata)
  return asStringClaim(claims.tenant_id) ?? asStringClaim(appMetadata?.tenant_id) ?? null
}

async function resolveTenantId(
  supabase: SupabaseClient<Database>,
  userId: string,
  claims: JwtClaims | null | undefined
): Promise<string | null> {
  const fromClaims = resolveTenantIdFromClaims(claims ?? null)
  if (fromClaims) return fromClaims

  const { data, error } = await supabase.rpc("get_user_tenant", {
    p_user_id: userId,
  })
  if (error) return null
  if (typeof data !== "string" || !data) return null
  return data
}

function pickRoleName(row: {
  is_restricted_login: boolean
  role:
    | { name: string }
    | { name: string }[]
    | null
}): string | null {
  const r = row.role
  if (!r) return null
  const one = Array.isArray(r) ? r[0] : r
  return one?.name ?? null
}

/**
 * When true, member/student users should be blocked at the edge and on authenticated API routes.
 * Staff roles (owner, admin, instructor) never return true here.
 */
export async function isPortalAccessSuspended(
  supabase: SupabaseClient<Database>,
  userId: string,
  claims: JwtClaims | null | undefined
): Promise<boolean> {
  const fromJwt = resolveRoleFromClaims(claims ?? {})
  if (fromJwt && isStaffRole(fromJwt)) {
    return false
  }

  const tenantId = await resolveTenantId(supabase, userId, claims)
  if (!tenantId) {
    return false
  }

  return isPortalAccessSuspendedForTenant(supabase, userId, tenantId)
}

/**
 * Same as {@link isPortalAccessSuspended} but with a known `tenantId` (e.g. from `getAuthSession`),
 * for API routes that already resolved the tenant.
 */
export async function isPortalAccessSuspendedForTenant(
  supabase: SupabaseClient<Database>,
  userId: string,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("tenant_users")
    .select(
      "is_restricted_login, role:roles!tenant_users_role_id_fkey(name)"
    )
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) {
    return false
  }

  const nameRaw = pickRoleName(data)
  if (!nameRaw) return false

  const nameNorm = nameRaw.toLowerCase()
  if (!isUserRole(nameNorm)) return false
  const role = nameNorm as UserRole
  if (isStaffRole(role)) {
    return false
  }
  if (isMemberOrStudentRole(role) && data.is_restricted_login) {
    return true
  }
  return false
}
