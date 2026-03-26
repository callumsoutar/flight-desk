import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { TENANT_LOGO_BUCKET, isProbablyUrl } from "@/lib/settings/logo-storage"

export async function resolveTenantLogoSignedUrl(value: string | null) {
  if (!value) return null
  if (isProbablyUrl(value)) return value

  const supabaseAdmin = createSupabaseAdminClient()
  const { data, error } = await supabaseAdmin.storage
    .from(TENANT_LOGO_BUCKET)
    .createSignedUrl(value, 60 * 60 * 24 * 30)

  if (error) return null
  return data?.signedUrl ?? null
}
