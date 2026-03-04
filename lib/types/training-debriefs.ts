export type TrainingDebriefInstructor = {
  id: string
  first_name: string | null
  last_name: string | null
  user_id: string | null
  user:
    | {
        first_name: string | null
        last_name: string | null
        email: string | null
      }
    | null
}

export type TrainingDebriefRow = {
  id: string
  date: string
  status: string | null
  syllabus_id: string | null
  booking_id: string | null
  lesson:
    | {
        id: string
        name: string
      }
    | null
  instructor: TrainingDebriefInstructor | null
  booking:
    | {
        aircraft:
          | {
              registration: string | null
            }
          | null
      }
    | null
  instructor_comments: string | null
  lesson_highlights: string | null
  areas_for_improvement: string | null
  focus_next_lesson: string | null
  airmanship: string | null
  safety_concerns: string | null
}

export type TrainingDebriefsResponse = {
  debriefs: TrainingDebriefRow[]
  has_more: boolean
  next_offset: number | null
}

