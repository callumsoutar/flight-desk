import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { EquipmentIssuanceMember } from "@/lib/types/equipment"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function fetchEquipmentIssuanceMembers(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<EquipmentIssuanceMember[]> {
  const { data, error } = await supabase
    .from("tenant_users")
    .select("user:user_directory!tenant_users_user_id_fkey(id, first_name, last_name, email)")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)

  if (error) throw error

  return (data ?? [])
    .map((row) => pickMaybeOne(row.user))
    .filter(
      (
        row
      ): row is EquipmentIssuanceMember =>
        Boolean(
          row &&
            typeof row.id === "string" &&
            row.id.length > 0 &&
            typeof row.email === "string" &&
            row.email.length > 0
        )
    )
    .sort((a, b) => {
      const left = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || a.email
      const right = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim() || b.email
      return left.localeCompare(right)
    })
}
