import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveMembershipsSettings, type MembershipsSettings } from "@/lib/settings/memberships-settings"
import type { Database } from "@/lib/types"

export async function fetchMembershipsSettings(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<MembershipsSettings> {
  const { data, error } = await supabase
    .from("tenant_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (error) throw error
  return resolveMembershipsSettings(data?.settings ?? null)
}

