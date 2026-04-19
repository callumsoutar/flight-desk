import type { SupabaseClient, User } from "@supabase/supabase-js"

import { claimsRoleToUserRole, isUserRole } from "@/lib/auth/roles"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { logWarn } from "@/lib/security/logger"
import { getUserTenantId } from "@/lib/auth/tenant"
import type { Database } from "@/lib/types"
import type { UserRole } from "@/lib/types/roles"

// When JWT custom claims omit tenant/role (e.g. no access-token hook yet), resolve from DB.
const LOG_CLAIMS_FALLBACKS = process.env.AUTH_LOG_CLAIMS_FALLBACKS === "true"

export type JwtClaims = {
  sub?: string
  email?: string
  role?: string
  app_role?: string
  tenant_id?: string
  app_metadata?: unknown
  user_metadata?: unknown
  [key: string]: unknown
}

export type AuthUser = Pick<User, "id" | "email" | "user_metadata">

export type AuthSession = {
  user: AuthUser | null
  claims: JwtClaims | null
  role: UserRole | null
  tenantId: string | null
}

export type GetAuthSessionOptions = {
  includeRole?: boolean
  requireUser?: boolean
  authoritativeRole?: boolean
  includeTenant?: boolean
  authoritativeTenant?: boolean
}

async function resolveRoleFromDatabase(
  supabase: SupabaseClient<Database>,
  userId: string,
  tenantId?: string | null
): Promise<UserRole | null> {
  const args: { p_user_id: string; p_tenant_id?: string } = { p_user_id: userId }
  if (tenantId) {
    args.p_tenant_id = tenantId
  }

  const { data, error } = await supabase.rpc("get_tenant_user_role", args)

  if (error) return null
  return isUserRole(data) ? data : null
}

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

function resolveTenantFromClaims(claims: JwtClaims): string | null {
  const appMetadata = asRecord(claims.app_metadata)

  return (
    asStringClaim(claims.tenant_id) ??
    asStringClaim(appMetadata?.tenant_id) ??
    null
  )
}

async function resolveTenantFromDatabase(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  return getUserTenantId(supabase, userId)
}

function logClaimsFallback(kind: "role" | "tenant", userId: string) {
  if (!LOG_CLAIMS_FALLBACKS) return
  logWarn(`[auth] Falling back to DB for ${kind} claim`, { kind, userId })
}

function claimsToUser(claims: JwtClaims, userId: string): AuthUser {
  const email = typeof claims.email === "string" ? claims.email : undefined
  const userMetadata =
    typeof claims.user_metadata === "object" && claims.user_metadata
      ? (claims.user_metadata as User["user_metadata"])
      : {}

  return {
    id: userId,
    email,
    user_metadata: userMetadata,
  }
}

function userToAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata ?? {},
  }
}

async function resolveAuthSession(
  supabase: SupabaseClient<Database>,
  options: GetAuthSessionOptions = {}
): Promise<AuthSession> {
  const {
    includeRole = false,
    requireUser = false,
    authoritativeRole = false,
    includeTenant = false,
    authoritativeTenant = false,
  } = options

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const claims = claimsError
    ? null
    : ((claimsData?.claims ?? null) as JwtClaims | null)

  const claimedUserId =
    typeof claims?.sub === "string" && claims.sub ? claims.sub : null

  if (!claims || !claimedUserId) {
    return { user: null, claims: null, role: null, tenantId: null }
  }

  const userId = claimedUserId
  const resolvedClaims = claims

  let user: AuthUser | null = claimsToUser(resolvedClaims, userId)

  if (requireUser) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const authUser = userData?.user ?? null
    if (userError || !authUser || authUser.id !== userId) {
      return { user: null, claims: null, role: null, tenantId: null }
    }
    user = userToAuthUser(authUser)
  }

  let role: UserRole | null = null
  let tenantId: string | null = null
  /** Cached tenant for this request (JWT claim or DB), used to scope get_tenant_user_role. */
  let sharedTenantId: string | null | undefined = undefined

  async function tenantForSession(): Promise<string | null> {
    if (sharedTenantId !== undefined) return sharedTenantId
    if (authoritativeTenant) {
      sharedTenantId = await resolveTenantFromDatabase(supabase, userId)
    } else {
      sharedTenantId =
        resolveTenantFromClaims(resolvedClaims) ??
        (await resolveTenantFromDatabase(supabase, userId))
    }
    return sharedTenantId
  }

  if (includeRole) {
    if (authoritativeRole) {
      role = await resolveRoleFromDatabase(supabase, userId, await tenantForSession())
    } else {
      role = resolveRoleFromClaims(resolvedClaims)
      if (!role) {
        logClaimsFallback("role", userId)
        role = await resolveRoleFromDatabase(supabase, userId, await tenantForSession())
      }
    }
  }

  if (includeTenant) {
    tenantId = await tenantForSession()
  }

  return { user, claims, role, tenantId }
}

export async function getAuthSession(
  supabase: SupabaseClient<Database>,
  options: GetAuthSessionOptions = {}
): Promise<AuthSession> {
  try {
    return await resolveAuthSession(supabase, options)
  } catch (error) {
    logWarn("[auth] Session resolution failed", {
      message: error instanceof Error ? error.message : String(error),
    })
    return { user: null, claims: null, role: null, tenantId: null }
  }
}

/**
 * Session shape used by `app/layout.tsx` (authoritative role + tenant, validated user).
 * Do not wrap in `cache()` — it can interact badly with streaming and auth timing on navigation.
 */
export async function loadRootLayoutAuthSession(): Promise<AuthSession> {
  const supabase = await createSupabaseServerClient()
  return getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    includeTenant: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })
}
