"use client"

import { useQuery } from "@tanstack/react-query"

import type { SchedulerPageData } from "@/lib/types/scheduler"

type SchedulerPageResponse = {
  data: SchedulerPageData
}

export function schedulerPageQueryKey(dateYyyyMmDd: string) {
  return ["scheduler-page", dateYyyyMmDd] as const
}

async function fetchSchedulerPageData(dateYyyyMmDd: string): Promise<SchedulerPageData> {
  const response = await fetch(`/api/scheduler?date=${encodeURIComponent(dateYyyyMmDd)}`, {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || "Failed to load scheduler data")
  }

  const payload = (await response.json().catch(() => null)) as SchedulerPageResponse | null
  if (!payload?.data) {
    throw new Error("Failed to load scheduler data")
  }

  return payload.data
}

export function useSchedulerPageQuery({
  dateYyyyMmDd,
  initialData,
}: {
  dateYyyyMmDd: string
  initialData: SchedulerPageData
}) {
  return useQuery({
    queryKey: schedulerPageQueryKey(dateYyyyMmDd),
    queryFn: () => fetchSchedulerPageData(dateYyyyMmDd),
    initialData: dateYyyyMmDd === initialData.dateYyyyMmDd ? initialData : undefined,
    staleTime: 30 * 1000,
  })
}
