import { NextResponse } from "next/server"

import { isPortalAccessSuspendedForTenant, PORTAL_ACCESS_DISABLED } from "@/lib/auth/portal-access"
import { getAuthSession } from "@/lib/auth/session"
import type { AuthUser } from "@/lib/auth/session"
import { isAdminRole, isStaffRole } from "@/lib/auth/roles"
import type { UserRole } from "@/lib/types/roles"
import type { Database } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

import { getRequiredApiSession } from "@/lib/auth/api-session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const NO_STORE_HEADERS = { "cache-control": "no-store" } as const

export function noStoreJson(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: {
      ...NO_STORE_HEADERS,
      ...(init?.headers ?? {}),
    },
  })
}

type TenantAdminRouteContext = {
  supabase: SupabaseClient<Database>
  user: AuthUser
  role: UserRole
  tenantId: string
}

type TenantStaffRouteContext = {
  supabase: SupabaseClient<Database>
  user: AuthUser
  role: UserRole
  tenantId: string
}

type TenantAdminRouteResult =
  | { context: TenantAdminRouteContext; response: null }
  | { context: null; response: NextResponse }

type TenantStaffRouteResult =
  | { context: TenantStaffRouteContext; response: null }
  | { context: null; response: NextResponse }

type TenantScopedRouteAccess = "authenticated" | "staff" | "admin"

type TenantScopedRouteContext = {
  supabase: SupabaseClient<Database>
  user: AuthUser
  role: UserRole | null
  tenantId: string
}

type TenantScopedRouteResult =
  | { context: TenantScopedRouteContext; response: null }
  | { context: null; response: NextResponse }

type GetTenantScopedRouteContextOptions = {
  access?: TenantScopedRouteAccess
  includeRole?: boolean
  authoritativeRole?: boolean
  existingSupabase?: SupabaseClient<Database>
}

export async function getTenantScopedRouteContext({
  access = "authenticated",
  includeRole = access !== "authenticated",
  authoritativeRole = includeRole || access !== "authenticated",
  existingSupabase,
}: GetTenantScopedRouteContextOptions = {}): Promise<TenantScopedRouteResult> {
  const supabase = existingSupabase ?? (await createSupabaseServerClient())
  const requiresRole = includeRole || access !== "authenticated"
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: requiresRole,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: requiresRole ? authoritativeRole : false,
    authoritativeTenant: true,
  })

  if (!user) {
    return { context: null, response: noStoreJson({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (!tenantId) {
    return { context: null, response: noStoreJson({ error: "Account not configured" }, { status: 400 }) }
  }

  if (access === "admin" && !isAdminRole(role)) {
    return { context: null, response: noStoreJson({ error: "Forbidden" }, { status: 403 }) }
  }

  if (access === "staff" && !isStaffRole(role)) {
    return { context: null, response: noStoreJson({ error: "Forbidden" }, { status: 403 }) }
  }

  if (access === "authenticated") {
    const suspended = await isPortalAccessSuspendedForTenant(
      supabase,
      user.id,
      tenantId
    )
    if (suspended) {
      return {
        context: null,
        response: noStoreJson(
          { error: "Portal access disabled", code: PORTAL_ACCESS_DISABLED },
          { status: 403 }
        ),
      }
    }
  }

  return {
    context: { supabase, user, role, tenantId },
    response: null,
  }
}

export async function getTenantAdminRouteContext(
  existingSupabase?: SupabaseClient<Database>
): Promise<TenantAdminRouteResult> {
  const supabase = existingSupabase ?? (await createSupabaseServerClient())
  const { user, role, tenantId } = await getRequiredApiSession(supabase, {
    includeRole: true,
    requireUser: true,
  })

  if (!user) {
    return { context: null, response: noStoreJson({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (!tenantId) {
    return { context: null, response: noStoreJson({ error: "Account not configured" }, { status: 400 }) }
  }

  if (!isAdminRole(role)) {
    return { context: null, response: noStoreJson({ error: "Forbidden" }, { status: 403 }) }
  }

  return {
    context: { supabase, user, role, tenantId },
    response: null,
  }
}

export async function getTenantStaffRouteContext(
  existingSupabase?: SupabaseClient<Database>
): Promise<TenantStaffRouteResult> {
  const supabase = existingSupabase ?? (await createSupabaseServerClient())
  const { user, role, tenantId } = await getRequiredApiSession(supabase, {
    includeRole: true,
    requireUser: true,
  })

  if (!user) {
    return { context: null, response: noStoreJson({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (!tenantId) {
    return { context: null, response: noStoreJson({ error: "Account not configured" }, { status: 400 }) }
  }

  if (!role || !["owner", "admin", "instructor"].includes(role)) {
    return { context: null, response: noStoreJson({ error: "Forbidden" }, { status: 403 }) }
  }

  return {
    context: { supabase, user, role, tenantId },
    response: null,
  }
}
