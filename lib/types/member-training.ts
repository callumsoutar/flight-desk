export type MemberTrainingComment = {
  id: string
  date: string
  instructor_comments: string | null
  booking_id: string | null
  booking: {
    aircraft: {
      registration: string | null
    } | null
  } | null
  instructor: {
    user: {
      first_name: string | null
      last_name: string | null
    } | null
  } | null
}

export type MemberTrainingCommentsResponse = {
  comments: MemberTrainingComment[]
  has_more: boolean
  next_offset: number | null
}

export type MemberTrainingSyllabusLite = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  voided_at: string | null
  number_of_exams: number
}

export type MemberTrainingEnrollment = {
  id: string
  syllabus_id: string
  status: string
  enrolled_at: string
  completion_date: string | null
  unenrolled_at: string | null
  notes: string | null
  primary_instructor_id: string | null
  aircraft_type: string | null
  syllabus: Pick<MemberTrainingSyllabusLite, "id" | "name" | "description" | "is_active" | "voided_at"> | null
  aircraft_types: { id: string; name: string } | null
}

export type MemberTrainingInstructorLite = {
  id: string
  user_id: string
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

export type MemberTrainingResponse = {
  training: {
    timeZone: string
    syllabi: MemberTrainingSyllabusLite[]
    enrollments: MemberTrainingEnrollment[]
    primaryInstructors: MemberTrainingInstructorLite[]
  }
}
