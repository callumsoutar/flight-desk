import { noStoreJson } from "@/lib/api/tenant-route"
import { isPortalAccessSuspendedForTenant, PORTAL_ACCESS_DISABLED } from "@/lib/auth/portal-access"
import { getAuthSession } from "@/lib/auth/session"
import { fetchUserProfile } from "@/lib/auth/user-profile"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    requireUser: true,
    authoritativeRole: true,
    includeTenant: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return noStoreJson({ user: null, role: null, profile: null })
  }

  if (tenantId) {
    const suspended = await isPortalAccessSuspendedForTenant(supabase, user.id, tenantId)
    if (suspended) {
      return noStoreJson(
        { error: "Portal access disabled", code: PORTAL_ACCESS_DISABLED },
        { status: 403 }
      )
    }
  }

  const profile = await fetchUserProfile(supabase, user)

  return noStoreJson({ user, role, profile })
}
