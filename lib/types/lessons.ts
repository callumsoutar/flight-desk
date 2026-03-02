import type { Enums, LessonRow } from "@/lib/types"

export type Lesson = LessonRow

export type SyllabusStage = Enums<"syllabus_stage">

export type LessonInsert = {
  syllabus_id: string
  name: string
  description: string | null
  is_required: boolean
  syllabus_stage: SyllabusStage | null
}

export type LessonUpdate = {
  name: string
  description: string | null
  is_required: boolean
  syllabus_stage: SyllabusStage | null
  is_active?: boolean
}

