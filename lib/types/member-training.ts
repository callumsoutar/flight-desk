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
