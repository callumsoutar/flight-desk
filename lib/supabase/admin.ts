import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import { getSupabaseAdminEnv } from "@/lib/supabase/env"

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminEnv()

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

