export type TrainingStudentOverviewNextLesson = {
  id: string
  name: string
  order: number
}

export type TrainingStudentOverviewNextBooking = {
  id: string
  start_time: string
  end_time: string
  status: string | null
  lesson:
    | {
        id: string
        name: string
      }
    | null
  instructor:
    | {
        id: string
        first_name: string | null
        last_name: string | null
        user:
          | {
              first_name: string | null
              last_name: string | null
              email: string | null
            }
          | null
      }
    | null
  aircraft:
    | {
        registration: string | null
      }
    | null
}

export type TrainingStudentOverviewLastActivity = {
  date: string
  status: string | null
  lesson:
    | {
        id: string
        name: string
      }
    | null
}

export type TrainingStudentOverviewLastDebrief = {
  id: string
  date: string
  lesson:
    | {
        id: string
        name: string
      }
    | null
  instructor:
    | {
        id: string
        first_name: string | null
        last_name: string | null
        user:
          | {
              first_name: string | null
              last_name: string | null
              email: string | null
            }
          | null
      }
    | null
}

export type TrainingStudentOverviewResponse = {
  syllabus_id: string
  enrolled_at: string | null
  completion_date: string | null
  enrollment_status: string | null
  progress: { completed: number; total: number; percent: number | null }
  theory: { passed: number; required: number }
  flight_hours_total: number | null
  lessons_per_month: number | null
  next_lesson: TrainingStudentOverviewNextLesson | null
  next_booking: TrainingStudentOverviewNextBooking | null
  last_activity: TrainingStudentOverviewLastActivity | null
  last_debrief: TrainingStudentOverviewLastDebrief | null
}
