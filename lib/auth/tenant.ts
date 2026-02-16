import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"

export async function getUserTenantId(
  supabase: SupabaseClient<Database>,
  userId?: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_user_tenant", {
    p_user_id: userId,
  })

  if (error) return null
  if (typeof data !== "string" || !data) return null
  return data
}

