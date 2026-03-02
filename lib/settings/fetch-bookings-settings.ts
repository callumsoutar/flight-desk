import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveBookingsSettings, type BookingsSettings } from "@/lib/settings/bookings-settings"
import type { Database } from "@/lib/types"

export async function fetchBookingsSettings(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<BookingsSettings> {
  const { data, error } = await supabase
    .from("tenant_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (error) throw error
  return resolveBookingsSettings(data?.settings ?? null)
}

