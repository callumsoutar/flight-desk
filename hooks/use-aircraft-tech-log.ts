"use client"

import { useQuery } from "@tanstack/react-query"

import type { AircraftTechLogResponse } from "@/lib/types/aircraft-tech-log"

type UseAircraftTechLogParams = {
  aircraftId: string
  page: number
  pageSize: number
}

async function fetchAircraftTechLog(
  aircraftId: string,
  page: number,
  pageSize: number
): Promise<AircraftTechLogResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })

  const response = await fetch(`/api/aircraft/${aircraftId}/tech-log?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to load aircraft tech log")
  }

  return payload as AircraftTechLogResponse
}

export function useAircraftTechLog({
  aircraftId,
  page,
  pageSize,
}: UseAircraftTechLogParams) {
  return useQuery({
    queryKey: ["aircraft-tech-log", aircraftId, page, pageSize],
    queryFn: () => fetchAircraftTechLog(aircraftId, page, pageSize),
    enabled: Boolean(aircraftId),
    placeholderData: (previousData) => previousData,
  })
}
