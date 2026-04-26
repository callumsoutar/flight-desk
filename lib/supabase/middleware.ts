import { createServerClient } from "@supabase/ssr"
import type { CookieOptions } from "@supabase/ssr"
import type { NextRequest } from "next/server"

import { isPortalAccessSuspended } from "@/lib/auth/portal-access"
import { claimsRoleToUserRole } from "@/lib/auth/roles"
import type { JwtClaims } from "@/lib/auth/session"
import type { Database } from "@/lib/types"
import type { UserRole } from "@/lib/types/roles"
import { getSupabasePublicEnv } from "@/lib/supabase/env-public"

export type CookieToSet = {
  name: string
  value: string
  options: CookieOptions
}

export async function updateSession(request: NextRequest): Promise<{
  userId: string | null
  role: UserRole | null
  cookiesToSet: CookieToSet[]
  portalAccessSuspended: boolean
}> {
  const cookiesToSet: CookieToSet[] = []
  const { url, anonKey } = getSupabasePublicEnv()

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(newCookies) {
        cookiesToSet.push(...newCookies)
      },
    },
  })

  // Middleware is on the hot path: rely on JWT/JWKS claims verification only.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as Record<string, unknown> | undefined
  const claimedUserId = claims?.sub
  const claimedRole =
    claimsRoleToUserRole(claims?.app_role) ?? claimsRoleToUserRole(claims?.role) ?? null
  if (!claimsError && typeof claimedUserId === "string" && claimedUserId) {
    const portalAccessSuspended = await isPortalAccessSuspended(
      supabase,
      claimedUserId,
      claims as JwtClaims
    )
    return { userId: claimedUserId, role: claimedRole, cookiesToSet, portalAccessSuspended }
  }

  return { userId: null, role: null, cookiesToSet, portalAccessSuspended: false }
}
