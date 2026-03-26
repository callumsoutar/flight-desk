import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/lib/types"
import { getSupabasePublicEnv } from "@/lib/supabase/env-public"

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabasePublicEnv()
  return createBrowserClient<Database>(url, anonKey)
}

