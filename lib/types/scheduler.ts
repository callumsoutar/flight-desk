import type { AircraftWithType } from "@/lib/types/aircraft"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type { InstructorRow, RosterRuleRow } from "@/lib/types/tables"

type DirectoryUserLite = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

export type SchedulerRosterRule = Pick<
  RosterRuleRow,
  | "id"
  | "instructor_id"
  | "day_of_week"
  | "start_time"
  | "end_time"
  | "effective_from"
  | "effective_until"
  | "is_active"
  | "voided_at"
>

export type SchedulerInstructor = Pick<
  InstructorRow,
  "id" | "first_name" | "last_name" | "user_id" | "status" | "is_actively_instructing"
> & {
  user: DirectoryUserLite | null
  roster_rules: SchedulerRosterRule[]
}

export type SchedulerBusinessHours = {
  openTime: string
  closeTime: string
  is24Hours: boolean
  isClosed: boolean
}

export type SchedulerPageData = {
  dateYyyyMmDd: string
  timeZone: string
  rangeStartUtcIso: string
  rangeEndUtcIso: string
  businessHours: SchedulerBusinessHours
  aircraft: AircraftWithType[]
  instructors: SchedulerInstructor[]
  bookings: BookingWithRelations[]
}
