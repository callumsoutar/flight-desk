import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, EquipmentIssuanceRow } from "@/lib/types"

export type EquipmentIssuanceHistoryData = {
  issuances: EquipmentIssuanceRow[]
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

export async function fetchEquipmentIssuanceHistory(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  equipmentId: string
): Promise<EquipmentIssuanceHistoryData> {
  const { data: issuanceRows, error: issuanceError } = await supabase
    .from("equipment_issuance")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("equipment_id", equipmentId)
    .order("issued_at", { ascending: false })

  if (issuanceError) throw issuanceError

  const issuances = issuanceRows ?? []
  if (issuances.length === 0) {
    return { issuances: [], userMap: {} }
  }

  const userIds = Array.from(new Set(issuances.flatMap((row) => [row.user_id, row.issued_by])))

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
    issuances,
    userMap,
  }
}
