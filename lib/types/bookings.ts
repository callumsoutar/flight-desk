import type { Database } from "@/lib/types/database"
import type { InvoiceCreateChargeable } from "@/lib/types/invoice-create"
import type {
  AircraftRow,
  AircraftTypesRow,
  AuditLogsRow,
  BookingRow,
  ChargeableTypesRow,
  FlightTypesRow,
  InstructorRow,
  LandingFeeRatesRow,
  LessonProgressRow,
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
  checked_out_instructor:
    | (Pick<InstructorRow, "id" | "first_name" | "last_name" | "user_id"> & {
        user: DirectoryUserLite | null
      })
    | null
  aircraft:
    | Pick<
        AircraftRow,
        | "id"
        | "registration"
        | "type"
        | "model"
        | "manufacturer"
        | "current_hobbs"
        | "current_tach"
        | "aircraft_type_id"
      >
    | null
  checked_out_aircraft:
    | Pick<
        AircraftRow,
        | "id"
        | "registration"
        | "type"
        | "model"
        | "manufacturer"
        | "current_hobbs"
        | "current_tach"
        | "aircraft_type_id"
      >
    | null
  flight_type: Pick<FlightTypesRow, "id" | "name" | "instruction_type"> | null
  lesson: Pick<LessonRow, "id" | "name" | "syllabus_id"> | null
  lesson_progress: LessonProgressRow[] | LessonProgressRow | null
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
    Pick<AircraftRow, "id" | "registration" | "type" | "model" | "manufacturer" | "aircraft_type_id">
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
  chargeables?: InvoiceCreateChargeable[]
  aircraftTypes?: Array<Pick<AircraftTypesRow, "id" | "name">>
  chargeableTypes?: Array<
    Pick<ChargeableTypesRow, "id" | "code" | "name" | "description" | "is_global" | "is_active">
  >
  landingFeeRates?: Array<Pick<LandingFeeRatesRow, "id" | "chargeable_id" | "aircraft_type_id" | "rate">>
}

export type AuditLog = AuditLogsRow & {
  user: DirectoryUserLite | null
}
