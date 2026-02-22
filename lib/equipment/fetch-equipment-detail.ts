import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, EquipmentRow } from "@/lib/types"

export async function fetchEquipmentDetail(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  equipmentId: string
): Promise<EquipmentRow | null> {
  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", equipmentId)
    .is("voided_at", null)
    .maybeSingle()

  if (error) throw error
  return data
}
