"use client"

import { useQuery } from "@tanstack/react-query"

import type { Lesson, LessonInsert, LessonUpdate } from "@/lib/types/lessons"

type LessonsQueryParams = {
  syllabusId: string | null
  includeInactive?: boolean
}

type LessonsResponse = {
  lessons?: Lesson[]
}

function buildLessonsQuery(params: LessonsQueryParams) {
  const query = new URLSearchParams()
  if (params.includeInactive) query.set("include_inactive", "true")
  if (params.syllabusId) query.set("syllabus_id", params.syllabusId)
  return query.toString()
}

export function lessonsQueryKey(params: LessonsQueryParams) {
  return ["lessons", params.syllabusId ?? "none", params.includeInactive ? "inactive" : "active"] as const
}

export async function fetchLessonsQuery(params: LessonsQueryParams): Promise<Lesson[]> {
  if (!params.syllabusId) return []

  const response = await fetch(`/api/lessons?${buildLessonsQuery(params)}`, {
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error("Failed to fetch lessons")
  }

  const data = (await response.json().catch(() => null)) as LessonsResponse | null
  return Array.isArray(data?.lessons) ? data.lessons : []
}

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function createLesson(input: LessonInsert) {
  const response = await fetch("/api/lessons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to create lesson"))
  }
}

export async function updateLesson(input: LessonUpdate & { id: string }) {
  const response = await fetch("/api/lessons", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update lesson"))
  }
}

export async function deactivateLesson(id: string) {
  const response = await fetch(`/api/lessons?id=${encodeURIComponent(id)}`, { method: "DELETE" })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to delete lesson"))
  }
}

export async function reorderLessons(input: {
  syllabus_id: string
  lesson_orders: { id: string; order: number }[]
}) {
  const response = await fetch("/api/lessons/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to reorder lessons"))
  }
}

export function useLessonsQuery(params: LessonsQueryParams) {
  return useQuery({
    queryKey: lessonsQueryKey(params),
    queryFn: () => fetchLessonsQuery(params),
    enabled: Boolean(params.syllabusId),
    staleTime: 60 * 1000,
  })
}
