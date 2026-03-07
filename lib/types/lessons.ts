import type { Enums, LessonRow } from "@/lib/types"

export type Lesson = LessonRow

export type SyllabusStage = Enums<"syllabus_stage">

/** All syllabus_stage enum values in display order (single source of truth for dropdowns and validation). */
export const SYLLABUS_STAGES: SyllabusStage[] = [
  "basic syllabus",
  "advanced syllabus",
  "circuit training",
  "terrain and weather awareness",
  "instrument flying and flight test revision",
]

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

