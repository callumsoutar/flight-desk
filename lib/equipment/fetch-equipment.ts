import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { EquipmentFilter, EquipmentWithIssuance } from "@/lib/types/equipment"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function fetchEquipment(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  filters?: EquipmentFilter
): Promise<EquipmentWithIssuance[]> {
  let equipmentQuery = supabase
    .from("equipment")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("voided_at", null)
    .order("name", { ascending: true })

  if (filters?.status) {
    equipmentQuery = equipmentQuery.eq("status", filters.status)
  }

  if (filters?.type) {
    equipmentQuery = equipmentQuery.eq("type", filters.type)
  }

  const { data: equipmentRows, error: equipmentError } = await equipmentQuery
  if (equipmentError) throw equipmentError

  const equipment = equipmentRows ?? []
  if (equipment.length === 0) return []

  const equipmentIds = equipment.map((row) => row.id)

  const [issuanceResult, updatesResult] = await Promise.all([
    supabase
      .from("equipment_issuance")
      .select(
        "*, issued_to_user:user_directory!equipment_issuance_user_id_fkey(id, first_name, last_name, email)"
      )
      .eq("tenant_id", tenantId)
      .in("equipment_id", equipmentIds)
      .is("returned_at", null)
      .order("issued_at", { ascending: false }),
    supabase
      .from("equipment_updates")
      .select("id, equipment_id, next_due_at, updated_at")
      .eq("tenant_id", tenantId)
      .in("equipment_id", equipmentIds)
      .order("updated_at", { ascending: false }),
  ])

  if (issuanceResult.error) throw issuanceResult.error
  if (updatesResult.error) throw updatesResult.error

  const issuanceByEquipment = new Map<string, (typeof issuanceResult.data)[number]>()
  for (const row of issuanceResult.data ?? []) {
    if (!issuanceByEquipment.has(row.equipment_id)) {
      issuanceByEquipment.set(row.equipment_id, row)
    }
  }

  const latestUpdateByEquipment = new Map<string, (typeof updatesResult.data)[number]>()
  for (const row of updatesResult.data ?? []) {
    if (!latestUpdateByEquipment.has(row.equipment_id)) {
      latestUpdateByEquipment.set(row.equipment_id, row)
    }
  }

  const search = filters?.search?.trim().toLowerCase()

  const enriched = equipment.map<EquipmentWithIssuance>((row) => {
    const issuance = issuanceByEquipment.get(row.id) ?? null
    const issuedTo = pickMaybeOne(issuance?.issued_to_user)

    return {
      ...row,
      current_issuance: issuance
        ? {
            ...issuance,
            issued_to_user: issuedTo,
          }
        : null,
      issued_to_user: issuedTo,
      latest_update: latestUpdateByEquipment.get(row.id) ?? null,
    }
  })

  const afterIssuedFilter =
    typeof filters?.issued === "boolean"
      ? enriched.filter((row) => (filters.issued ? Boolean(row.current_issuance) : !row.current_issuance))
      : enriched

  if (!search) return afterIssuedFilter

  return afterIssuedFilter.filter((row) => {
    const haystack = [row.name, row.serial_number ?? "", row.type, row.label ?? "", row.location ?? ""]
      .join(" ")
      .toLowerCase()

    const issuedTo = [row.issued_to_user?.first_name, row.issued_to_user?.last_name, row.issued_to_user?.email]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return haystack.includes(search) || issuedTo.includes(search)
  })
}
