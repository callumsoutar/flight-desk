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

export type TrainingStudentOverviewResponse = {
  syllabus_id: string
  enrolled_at: string | null
  completion_date: string | null
  enrollment_status: string | null
  progress: { completed: number; total: number; percent: number | null }
  theory: { passed: number; required: number }
  next_lesson: TrainingStudentOverviewNextLesson | null
  next_booking: TrainingStudentOverviewNextBooking | null
  last_activity: TrainingStudentOverviewLastActivity | null
}
