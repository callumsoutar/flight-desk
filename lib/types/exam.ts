import type { ExamRow } from "@/lib/types"

export type Exam = ExamRow

export type ExamFormData = {
  name: string
  description: string
  syllabus_id: string | "none"
  passing_score: number
  is_active: boolean
}

