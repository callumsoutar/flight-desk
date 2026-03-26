import "server-only"

import { getSupabasePublicEnv } from "@/lib/supabase/env-public"

type SupabaseAdminEnv = {
  url: string
  anonKey: string
  serviceRoleKey: string
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export function getSupabaseAdminEnv(): SupabaseAdminEnv {
  const { url, anonKey } = getSupabasePublicEnv()
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  return {
    url,
    anonKey,
    serviceRoleKey: requireEnv(
      "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
      serviceRoleKey
    ),
  }
}
