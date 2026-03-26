import type { SupabaseClient } from "@supabase/supabase-js"

import { getAuthSession } from "@/lib/auth/session"
import type { Database } from "@/lib/types"

type ApiSessionOptions = {
  includeRole?: boolean
  includeTenant?: boolean
  requireUser?: boolean
}

export async function getRequiredApiSession(
  supabase: SupabaseClient<Database>,
  options: ApiSessionOptions = {}
) {
  const {
    includeRole = false,
    includeTenant = true,
    requireUser = false,
  } = options

  return getAuthSession(supabase, {
    requireUser,
    includeRole,
    includeTenant,
    authoritativeRole: includeRole,
    authoritativeTenant: includeTenant,
  })
}
