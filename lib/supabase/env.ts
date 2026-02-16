type SupabasePublicEnv = {
  url: string
  anonKey: string
}

type SupabaseAdminEnv = SupabasePublicEnv & {
  serviceRoleKey: string
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL
  )
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return {
    url,
    anonKey: requireEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      anonKey
    ),
  }
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

