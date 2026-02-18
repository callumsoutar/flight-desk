import type { AircraftComponentsRow, MaintenanceVisitsRow, UserDirectoryRow } from "@/lib/types"

type DirectoryUserLite = Pick<UserDirectoryRow, "id" | "first_name" | "last_name" | "email">
type ComponentLite = Pick<AircraftComponentsRow, "id" | "name">

export type AircraftMaintenanceVisitEntry = MaintenanceVisitsRow & {
  performed_by_user: DirectoryUserLite | null
  component?: ComponentLite | null
}

export type AircraftMaintenanceVisitsResponse = {
  visits: AircraftMaintenanceVisitEntry[]
}
