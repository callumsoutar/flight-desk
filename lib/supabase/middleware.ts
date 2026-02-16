import { createServerClient } from "@supabase/ssr"
import type { CookieOptions } from "@supabase/ssr"
import type { NextRequest } from "next/server"

import type { Database } from "@/lib/types"
import { getSupabasePublicEnv } from "@/lib/supabase/env"

export type CookieToSet = {
  name: string
  value: string
  options: CookieOptions
}

export async function updateSession(request: NextRequest): Promise<{
  userId: string | null
  cookiesToSet: CookieToSet[]
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

  // Prefer local/JWKS-backed verification via getClaims() for lower latency.
  // With symmetric projects this may still hit Auth internally, but keeps us
  // aligned as projects migrate to asymmetric JWT signing keys.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const claimedUserId = claimsData?.claims?.sub
  if (!claimsError && typeof claimedUserId === "string" && claimedUserId) {
    return { userId: claimedUserId, cookiesToSet }
  }

  // Fallback keeps behavior robust while migrating key setups.
  const { data, error } = await supabase.auth.getUser()
  if (error) return { userId: null, cookiesToSet }

  return { userId: data.user?.id ?? null, cookiesToSet }
}
