export type TrainingLessonRow = {
  id: string
  name: string
  order: number
}

export type TrainingLessonAttemptInstructor = {
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

export type TrainingLessonAttemptRow = {
  id: string
  lesson_id: string | null
  date: string
  completed_at: string | null
  attempt: number | null
  status: string | null
  booking_id: string | null
  instructor_comments: string | null
  instructor: TrainingLessonAttemptInstructor | null
}

export type TrainingLessonStatus = "not_started" | "in_progress" | "needs_repeat" | "completed"

export type TrainingLessonProgressRow = {
  lesson: TrainingLessonRow
  status: TrainingLessonStatus
  attempts: number
  latest_attempt: TrainingLessonAttemptRow | null
  completed_at: string | null
}

export type TrainingFlyingResponse = {
  syllabus_id: string
  lessons: TrainingLessonProgressRow[]
}

