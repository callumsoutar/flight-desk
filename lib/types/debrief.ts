import type { LessonProgressRow } from "@/lib/types/tables"
import type { BookingWithRelations } from "@/lib/types/bookings"

type DirectoryUserLite = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

type InstructorLite = {
  id: string
  first_name: string | null
  last_name: string | null
  user_id: string | null
  user: DirectoryUserLite | null
}

export type LessonProgressWithInstructor = LessonProgressRow & {
  instructor: InstructorLite | null
}

export type ExperienceTypeLite = {
  id: string
  name: string
}

export type FlightExperienceEntryWithType = {
  id: string
  occurred_at: string
  value: number
  unit: "hours" | "count" | "landings"
  notes: string | null
  conditions: string | null
  experience_type: ExperienceTypeLite | null
}

export type DebriefPageData = {
  booking: BookingWithRelations | null
  lessonProgress: LessonProgressWithInstructor | null
  flightExperiences: FlightExperienceEntryWithType[]
  experienceTypes: ExperienceTypeLite[]
}
