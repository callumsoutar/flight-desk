export type TrainingOverviewView = "all" | "active" | "stale" | "at_risk"

export type TrainingActivityStatus = "active" | "stale" | "at_risk" | "new"

export type TrainingOverviewSyllabus = {
  id: string
  name: string
}

export type TrainingOverviewStudent = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

export type TrainingOverviewInstructor = {
  id: string
  first_name: string | null
  last_name: string | null
  user_id: string
}

export type TrainingOverviewProgress = {
  completed: number
  total: number
  percent: number | null
}

export type TrainingOverviewRow = {
  enrollment_id: string
  enrolled_at: string
  completion_date: string | null
  enrollment_status: string
  user_id: string
  syllabus_id: string
  primary_instructor_id: string | null
  student: TrainingOverviewStudent
  syllabus: TrainingOverviewSyllabus
  primaryInstructor: TrainingOverviewInstructor | null
  last_flight_at: string | null
  days_since_last_flight: number | null
  days_since_enrolled: number
  progress: TrainingOverviewProgress
  activity_status: TrainingActivityStatus
}

export type TrainingOverviewResponse = {
  generated_at: string
  syllabi: TrainingOverviewSyllabus[]
  rows: TrainingOverviewRow[]
}

