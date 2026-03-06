export type MemberTrainingPeekInstructor = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

export type MemberTrainingPeekResponse = {
  enrollment:
    | {
        id: string
        status: string | null
        syllabus: { id: string; name: string } | null
        aircraft_type: { id: string; name: string } | null
        primary_instructor: MemberTrainingPeekInstructor | null
      }
    | null
  next_lesson: { id: string; name: string; order: number | null } | null
  suggested_lesson: { id: string; name: string; order: number | null } | null
  next_lesson_booking:
    | {
        id: string
        start_time: string
        end_time: string
        status: string | null
      }
    | null
}
