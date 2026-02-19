import type { Json, RosterRuleRow, UserDirectoryRow } from "@/lib/types"

export type RosterRule = Pick<
  RosterRuleRow,
  | "id"
  | "instructor_id"
  | "day_of_week"
  | "start_time"
  | "end_time"
  | "effective_from"
  | "effective_until"
  | "is_active"
  | "notes"
  | "voided_at"
  | "created_at"
  | "updated_at"
>

export type RosterInstructor = {
  id: string
  first_name: string | null
  last_name: string | null
  user: Pick<UserDirectoryRow, "first_name" | "last_name" | "email"> | null
}

export type TimelineConfig = {
  startHour: number
  endHour: number
  intervalMinutes: number
}

export type RosterPageData = {
  instructors: RosterInstructor[]
  rosterRules: RosterRule[]
  timelineConfig: TimelineConfig
  tenantSettings: Json | null
}
