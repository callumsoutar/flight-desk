import type {
  Database,
  EquipmentIssuanceRow,
  EquipmentRow,
  EquipmentUpdatesRow,
  UserDirectoryRow,
} from "@/lib/types"

export type EquipmentType = Database["public"]["Enums"]["equipment_type"]
export type EquipmentStatus = Database["public"]["Enums"]["equipment_status"]

export type EquipmentTypeOption = {
  value: EquipmentType
  label: string
}

export const EQUIPMENT_TYPE_OPTIONS: EquipmentTypeOption[] = [
  { value: "AIP", label: "AIP" },
  { value: "Stationery", label: "Stationery" },
  { value: "Headset", label: "Headset" },
  { value: "Technology", label: "Technology" },
  { value: "Maps", label: "Maps" },
  { value: "Radio", label: "Radio" },
  { value: "Transponder", label: "Transponder" },
  { value: "ELT", label: "ELT" },
  { value: "Lifejacket", label: "Lifejacket" },
  { value: "FirstAidKit", label: "First Aid Kit" },
  { value: "FireExtinguisher", label: "Fire Extinguisher" },
  { value: "Other", label: "Other" },
]

export type EquipmentFilter = {
  search?: string
  status?: EquipmentStatus
  type?: EquipmentType
  issued?: boolean
}

type EquipmentIssuanceWithUser = EquipmentIssuanceRow & {
  issued_to_user: Pick<UserDirectoryRow, "id" | "first_name" | "last_name" | "email"> | null
}

export type EquipmentWithIssuance = EquipmentRow & {
  current_issuance: EquipmentIssuanceWithUser | null
  issued_to_user: Pick<UserDirectoryRow, "id" | "first_name" | "last_name" | "email"> | null
  latest_update: Pick<EquipmentUpdatesRow, "id" | "next_due_at" | "updated_at"> | null
}
