"use client"

import type { Lesson, SyllabusStage } from "@/lib/types/lessons"
import type { Syllabus } from "@/lib/types/syllabus"

export const fetchSyllabi = async (): Promise<Syllabus[]> => {
  const response = await fetch("/api/syllabus?include_inactive=true")
  if (!response.ok) throw new Error("Failed to fetch syllabi")
  const data = (await response.json().catch(() => null)) as { syllabi?: Syllabus[] } | null
  return Array.isArray(data?.syllabi) ? data.syllabi : []
}

export const fetchLessons = async (syllabusId: string): Promise<Lesson[]> => {
  const response = await fetch(`/api/lessons?include_inactive=true&syllabus_id=${encodeURIComponent(syllabusId)}`)
  if (!response.ok) throw new Error("Failed to fetch lessons")
  const data = (await response.json().catch(() => null)) as { lessons?: Lesson[] } | null
  return Array.isArray(data?.lessons) ? data.lessons : []
}

export function titleCaseStage(stage: SyllabusStage | string) {
  const normalized = stage === "advances syllabus" ? "advanced syllabus" : stage
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
