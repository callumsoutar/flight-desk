export type BookingWarningSeverity = "critical" | "high" | "medium" | "low"

export type BookingWarningCategory = "pilot" | "instructor" | "aircraft"

export type BookingWarningsStatus = "clear" | "warning" | "blocked"

export type BookingWarningItem = {
  id: string
  code: string
  category: BookingWarningCategory
  severity: BookingWarningSeverity
  blocking: boolean
  title: string
  detail: string
  source_label: string | null
  due_at: string | null
  days_remaining: number | null
  hours_remaining: number | null
  countdown_label: string | null
  action_href: string | null
  action_label: string | null
  observation_id: string | null
}

export type BookingWarningGroup = {
  category: BookingWarningCategory
  title: string
  description: string
  subject_label: string
  warning_count: number
  blocking_count: number
  warnings: BookingWarningItem[]
}

export type BookingWarningsSummary = {
  status: BookingWarningsStatus
  has_blockers: boolean
  requires_acknowledgement: boolean
  total_count: number
  blocking_count: number
  counts: Record<BookingWarningSeverity, number>
}

export type BookingWarningsResponse = {
  booking_id: string
  fetched_at: string
  context: {
    user_id: string | null
    instructor_id: string | null
    aircraft_id: string | null
  }
  summary: BookingWarningsSummary
  groups: BookingWarningGroup[]
}
