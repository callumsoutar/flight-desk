import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveInvoicingSettings, type InvoicingSettings } from "@/lib/settings/invoicing-settings"
import type { Database } from "@/lib/types"

export async function fetchInvoicingSettings(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<InvoicingSettings> {
  const { data, error } = await supabase
    .from("tenant_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (error) throw error
  return resolveInvoicingSettings(data?.settings ?? null)
}

