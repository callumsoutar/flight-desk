import type { SyllabusRow } from "@/lib/types"

export type Syllabus = SyllabusRow

export type SyllabusFormData = {
  name: string
  description: string
  number_of_exams: number
  is_active: boolean
}

