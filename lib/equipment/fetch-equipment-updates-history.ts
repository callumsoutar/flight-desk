import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, EquipmentUpdatesRow } from "@/lib/types"

export type EquipmentUpdatesHistoryData = {
  updates: EquipmentUpdatesRow[]
  userMap: Record<string, string>
}

function toDisplayName(user: {
  id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
}) {
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
  if (fullName.length > 0) return fullName
  if (user.email && user.email.length > 0) return user.email
  return user.id ?? ""
}

export async function fetchEquipmentUpdatesHistory(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  equipmentId: string
): Promise<EquipmentUpdatesHistoryData> {
  const { data: updateRows, error: updateError } = await supabase
    .from("equipment_updates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("equipment_id", equipmentId)
    .order("updated_at", { ascending: false })

  if (updateError) throw updateError

  const updates = updateRows ?? []
  if (updates.length === 0) {
    return { updates: [], userMap: {} }
  }

  const userIds = Array.from(new Set(updates.map((row) => row.updated_by)))

  const { data: users, error: usersError } = await supabase
    .from("user_directory")
    .select("id, first_name, last_name, email")
    .in("id", userIds)

  if (usersError) throw usersError

  const userMap: Record<string, string> = {}
  for (const user of users ?? []) {
    if (!user.id) continue
    userMap[user.id] = toDisplayName(user)
  }

  return {
    updates,
    userMap,
  }
}
