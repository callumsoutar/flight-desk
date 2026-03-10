import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveXeroSettings, type XeroSettings } from "@/lib/settings/xero-settings"
import type { Database, Json } from "@/lib/types"

export async function fetchXeroSettings(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<XeroSettings> {
  const { data, error } = await supabase
    .from("tenant_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (error) throw error

  const root = data?.settings
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    return resolveXeroSettings(null)
  }

  const xeroSettings = (root as Record<string, unknown>).xero ?? null
  return resolveXeroSettings(xeroSettings as Json)
}
