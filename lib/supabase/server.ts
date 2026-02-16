import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/lib/types"
import { getSupabasePublicEnv } from "@/lib/supabase/env"

export async function createSupabaseServerClient() {
  const cookieStore = await Promise.resolve(cookies())
  const { url, anonKey } = getSupabasePublicEnv()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components can't set cookies; Route Handlers / Middleware can.
        }
      },
    },
  })
}
