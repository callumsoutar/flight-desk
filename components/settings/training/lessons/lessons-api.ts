"use client"

import type { SyllabusStage } from "@/lib/types/lessons"

export function titleCaseStage(stage: SyllabusStage | string) {
  const normalized = stage === "advances syllabus" ? "advanced syllabus" : stage
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
