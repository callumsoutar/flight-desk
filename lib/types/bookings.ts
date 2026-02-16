import type { Database } from "@/lib/types/database"
import type {
  AircraftRow,
  AuditLogsRow,
  BookingRow,
  FlightTypesRow,
  InstructorRow,
  LessonRow,
} from "@/lib/types/tables"

export type BookingStatus = Database["public"]["Enums"]["booking_status"]
export type BookingType = Database["public"]["Enums"]["booking_type"]

type DirectoryUserLite = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

export type BookingWithRelations = BookingRow & {
  student: DirectoryUserLite | null
  instructor:
    | (Pick<InstructorRow, "id" | "first_name" | "last_name" | "user_id"> & {
        user: DirectoryUserLite | null
      })
    | null
  aircraft: Pick<AircraftRow, "id" | "registration" | "type" | "model" | "manufacturer"> | null
  flight_type: Pick<FlightTypesRow, "id" | "name" | "instruction_type"> | null
  lesson: Pick<LessonRow, "id" | "name" | "syllabus_id"> | null
}

export type BookingsFilter = {
  status?: BookingStatus[]
  booking_type?: BookingType[]
  search?: string
  aircraft_id?: string
  instructor_id?: string
  user_id?: string
  start_date?: string
  end_date?: string
}

export type BookingOptions = {
  aircraft: Array<
    Pick<AircraftRow, "id" | "registration" | "type" | "model" | "manufacturer">
  >
  members: DirectoryUserLite[]
  instructors: Array<
    Pick<InstructorRow, "id" | "first_name" | "last_name" | "user_id"> & {
      user: DirectoryUserLite | null
    }
  >
  flightTypes: Array<Pick<FlightTypesRow, "id" | "name" | "instruction_type">>
  syllabi: Array<{ id: string; name: string }>
  lessons: Array<Pick<LessonRow, "id" | "name" | "description" | "order" | "syllabus_id">>
}

export type AuditLog = AuditLogsRow & {
  user: DirectoryUserLite | null
}
