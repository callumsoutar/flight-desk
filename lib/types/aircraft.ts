import type { AircraftRow, AircraftTypesRow } from "@/lib/types"

export type AircraftType = AircraftTypesRow
export type AircraftTypeLite = Pick<AircraftTypesRow, "id" | "name" | "category">

export type AircraftWithType = AircraftRow & {
  aircraft_type: AircraftTypeLite | null
}

export type AircraftFilter = {
  search?: string
  status?: string
  aircraft_type_id?: string
}
