"use client"

import { useQuery } from "@tanstack/react-query"

import type { MemberTrainingResponse } from "@/lib/types/member-training"
import type { TrainingTheoryResponse } from "@/lib/types/training-theory"

export type TrainingExamLite = { id: string; name: string }

export function memberTrainingQueryKey(memberId: string) {
  return ["member-training", memberId] as const
}

export function memberTrainingTheoryQueryKey(memberId: string, syllabusId: string) {
  return ["member-training-theory", memberId, syllabusId] as const
}

function getMemberTrainingError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

export async function fetchMemberTraining(memberId: string): Promise<MemberTrainingResponse> {
  const response = await fetch(`/api/members/${memberId}/training`, {
    method: "GET",
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => ({}))) as MemberTrainingResponse & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(getMemberTrainingError(payload, "Failed to load training data"))
  }

  return payload
}

export async function fetchMemberTrainingTheory(
  memberId: string,
  syllabusId: string,
  signal?: AbortSignal
): Promise<TrainingTheoryResponse> {
  const url = new URL(`/api/members/${memberId}/training/theory`, window.location.origin)
  url.searchParams.set("syllabus_id", syllabusId)

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
    signal,
  })
  const payload = (await response.json().catch(() => ({}))) as TrainingTheoryResponse & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(getMemberTrainingError(payload, "Failed to load theory results"))
  }

  return payload
}

export async function fetchTrainingExamsForSyllabus(syllabusId: string): Promise<TrainingExamLite[]> {
  const response = await fetch(`/api/exams?syllabus_id=${encodeURIComponent(syllabusId)}`, {
    method: "GET",
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => ({}))) as { exams?: TrainingExamLite[]; error?: string }
  if (!response.ok) {
    throw new Error(getMemberTrainingError(payload, "Failed to load exams"))
  }

  return payload.exams ?? []
}

export async function createTrainingExamResult(
  memberId: string,
  input: {
    exam_id: string
    result: "PASS" | "FAIL"
    score?: number | null
    exam_date?: string
    notes?: string | null
  }
) {
  const response = await fetch(`/api/members/${memberId}/training/exam-results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) {
    throw new Error(getMemberTrainingError(payload, "Failed to log exam result"))
  }
}

export async function createTrainingEnrollment(
  memberId: string,
  input: {
    syllabus_id: string
    enrolled_at?: string
    notes?: string | null
    primary_instructor_id?: string | null
    aircraft_type?: string | null
  }
) {
  const response = await fetch(`/api/members/${memberId}/training/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) {
    throw new Error(getMemberTrainingError(payload, "Failed to enroll member"))
  }
}

export async function updateTrainingEnrollment(
  memberId: string,
  enrollmentId: string,
  input: {
    enrolled_at?: string | null
    completion_date?: string | null
    unenrolled_at?: string | null
    status?: "active" | "completed" | "withdrawn"
    notes?: string | null
    primary_instructor_id?: string | null
    aircraft_type?: string | null
  }
) {
  const response = await fetch(`/api/members/${memberId}/training/enrollments/${enrollmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) {
    throw new Error(getMemberTrainingError(payload, "Failed to update enrollment"))
  }
}

export async function unenrollTrainingEnrollment(
  memberId: string,
  enrollmentId: string,
  input?: { unenrolled_at?: string | null; notes?: string | null }
) {
  return updateTrainingEnrollment(memberId, enrollmentId, {
    status: "withdrawn",
    completion_date: null,
    unenrolled_at: input?.unenrolled_at ?? null,
    notes: input?.notes,
  })
}

export function useMemberTrainingQuery(memberId: string) {
  return useQuery({
    queryKey: memberTrainingQueryKey(memberId),
    queryFn: () => fetchMemberTraining(memberId),
    enabled: Boolean(memberId),
    staleTime: 30_000,
  })
}
