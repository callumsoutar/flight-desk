import { noStoreJson } from "@/lib/api/tenant-route"

import { getAuthSession } from "@/lib/auth/session"
import { fetchUserProfile } from "@/lib/auth/user-profile"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, {
    includeRole: true,
    requireUser: true,
    authoritativeRole: true,
  })

  if (!user) {
    return noStoreJson({ user: null, role: null, profile: null })
  }

  const profile = await fetchUserProfile(supabase, user)

  return noStoreJson({ user, role, profile })
}
