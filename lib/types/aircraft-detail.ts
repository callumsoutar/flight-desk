import type {
  AircraftComponentsRow,
  BookingRow,
  FlightTypesRow,
  InstructorRow,
  LessonRow,
  MaintenanceVisitsRow,
  ObservationRow,
  UserDirectoryRow,
} from "@/lib/types"
import type { AircraftWithType } from "@/lib/types/aircraft"

type DirectoryUserLite = Pick<
  UserDirectoryRow,
  "id" | "first_name" | "last_name" | "email"
>

export type FlightEntry = Pick<
  BookingRow,
  | "id"
  | "user_id"
  | "instructor_id"
  | "checked_out_aircraft_id"
  | "checked_out_instructor_id"
  | "start_time"
  | "end_time"
  | "status"
  | "purpose"
  | "hobbs_start"
  | "hobbs_end"
  | "tach_start"
  | "tach_end"
  | "billing_hours"
  | "created_at"
> & {
  student: DirectoryUserLite | null
  instructor:
    | (Pick<InstructorRow, "id" | "first_name" | "last_name" | "user_id"> & {
        user: DirectoryUserLite | null
      })
    | null
  flight_type: Pick<FlightTypesRow, "id" | "name"> | null
  lesson: Pick<LessonRow, "id" | "name"> | null
}

export type ObservationWithUsers = ObservationRow & {
  reported_by_user: DirectoryUserLite | null
  assigned_to_user: DirectoryUserLite | null
}

export type MaintenanceVisitWithUser = MaintenanceVisitsRow & {
  performed_by_user: DirectoryUserLite | null
}

export type AircraftDetailData = {
  aircraft: AircraftWithType
  flights: FlightEntry[]
  maintenanceVisits: MaintenanceVisitWithUser[]
  observations: ObservationWithUsers[]
  components: AircraftComponentsRow[]
}

