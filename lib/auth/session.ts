import type { SupabaseClient, User } from "@supabase/supabase-js"
import { cache } from "react"

import { claimsRoleToUserRole, isUserRole } from "@/lib/auth/roles"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { logWarn } from "@/lib/security/logger"
import { getUserTenantId } from "@/lib/auth/tenant"
import type { Database } from "@/lib/types"
import type { UserRole } from "@/lib/types/roles"

// Default to strict claims mode; allow explicit opt-out for emergency rollback.
const STRICT_CLAIMS_MODE = process.env.AUTH_CLAIMS_STRICT !== "false"
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
  userId: string
): Promise<UserRole | null> {
  const { data, error } = await supabase.rpc("get_tenant_user_role", {
    p_user_id: userId,
  })

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

export async function getAuthSession(
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

  let user: AuthUser | null = claimsToUser(claims, claimedUserId)

  if (requireUser) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const authUser = userData?.user ?? null
    if (userError || !authUser || authUser.id !== claimedUserId) {
      return { user: null, claims: null, role: null, tenantId: null }
    }
    user = userToAuthUser(authUser)
  }

  let role: UserRole | null = null
  let tenantId: string | null = null
  let rolePromise: Promise<UserRole | null> | null = null
  let tenantPromise: Promise<string | null> | null = null

  if (includeRole) {
    if (authoritativeRole) {
      rolePromise = resolveRoleFromDatabase(supabase, claimedUserId)
    } else {
      role = resolveRoleFromClaims(claims)
      if (!role && !STRICT_CLAIMS_MODE) {
        logClaimsFallback("role", claimedUserId)
        rolePromise = resolveRoleFromDatabase(supabase, claimedUserId)
      }
    }
  }

  if (includeTenant) {
    if (authoritativeTenant) {
      tenantPromise = resolveTenantFromDatabase(supabase, claimedUserId)
    } else {
      tenantId = resolveTenantFromClaims(claims)
      if (!tenantId && !STRICT_CLAIMS_MODE) {
        logClaimsFallback("tenant", claimedUserId)
        tenantPromise = resolveTenantFromDatabase(supabase, claimedUserId)
      }
    }
  }

  if (rolePromise || tenantPromise) {
    const [resolvedRole, resolvedTenantId] = await Promise.all([
      rolePromise ?? Promise.resolve(role),
      tenantPromise ?? Promise.resolve(tenantId),
    ])
    role = resolvedRole
    tenantId = resolvedTenantId
  }

  return { user, claims, role, tenantId }
}

/**
 * Cached per request: same Supabase session resolution as `app/layout.tsx`.
 * Use this from route segments that need the same session shape so work is not duplicated
 * (e.g. layout + `/login` + `/dashboard` on first load).
 */
export const getRootLayoutAuthSession = cache(async () => {
  const supabase = await createSupabaseServerClient()
  return getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    includeTenant: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })
})
