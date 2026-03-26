"use client"

import { useQuery } from "@tanstack/react-query"

import type { Exam } from "@/lib/types/exam"

type ExamsQueryParams = {
  includeInactive?: boolean
}

type ExamsResponse = {
  exams?: Exam[]
}

function buildExamsQuery(params: ExamsQueryParams) {
  const query = new URLSearchParams()
  if (params.includeInactive) query.set("include_inactive", "true")
  return query.toString()
}

export function examsQueryKey(params: ExamsQueryParams) {
  return ["exams", params.includeInactive ? "inactive" : "active"] as const
}

export async function fetchExamsQuery(params: ExamsQueryParams): Promise<Exam[]> {
  const response = await fetch(`/api/exams?${buildExamsQuery(params)}`, {
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error("Failed to fetch exams")
  }

  const data = (await response.json().catch(() => null)) as ExamsResponse | null
  return Array.isArray(data?.exams) ? data.exams : []
}

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function createExam(input: {
  name: string
  description: string
  passing_score: number
  is_active: boolean
  syllabus_id: string | null
}) {
  const response = await fetch("/api/exams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to create exam"))
  }
}

export async function updateExam(input: {
  id: string
  name: string
  description: string
  passing_score: number
  is_active: boolean
  syllabus_id: string | null
}) {
  const response = await fetch("/api/exams", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update exam"))
  }
}

export async function deactivateExam(id: string) {
  const response = await fetch(`/api/exams?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to deactivate exam"))
  }
}

export function useExamsQuery(params: ExamsQueryParams) {
  return useQuery({
    queryKey: examsQueryKey(params),
    queryFn: () => fetchExamsQuery(params),
    staleTime: 60 * 1000,
  })
}
