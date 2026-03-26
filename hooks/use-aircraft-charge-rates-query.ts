"use client"

import { useQuery } from "@tanstack/react-query"

export type AircraftChargeRate = {
  id: string
  aircraft_id: string
  flight_type_id: string
  rate_per_hour: number
  charge_hobbs: boolean
  charge_tacho: boolean
  charge_airswitch: boolean
}

type AircraftChargeRatesResponse = {
  rates?: AircraftChargeRate[]
  error?: string
}

type AircraftChargeRateResponse = {
  rate?: AircraftChargeRate
  error?: string
}

type ErrorResponse = {
  error?: string
}

export function aircraftChargeRatesQueryKey(aircraftId: string) {
  return ["aircraft-charge-rates", aircraftId] as const
}

export async function fetchAircraftChargeRates(aircraftId: string): Promise<AircraftChargeRate[]> {
  const response = await fetch(`/api/aircraft-charge-rates?aircraft_id=${encodeURIComponent(aircraftId)}`, {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })

  const payload = (await response.json().catch(() => null)) as AircraftChargeRatesResponse | null
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load aircraft charge rates")
  }

  return Array.isArray(payload?.rates) ? payload.rates : []
}

export function useAircraftChargeRatesQuery(aircraftId: string) {
  return useQuery({
    queryKey: aircraftChargeRatesQueryKey(aircraftId),
    queryFn: () => fetchAircraftChargeRates(aircraftId),
    staleTime: 60 * 1000,
  })
}

export async function createAircraftChargeRate(input: {
  aircraft_id: string
  flight_type_id: string
  rate_per_hour: number
  charge_hobbs: boolean
  charge_tacho: boolean
  charge_airswitch: boolean
}) {
  const response = await fetch("/api/aircraft-charge-rates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  const payload = (await response.json().catch(() => null)) as AircraftChargeRateResponse | ErrorResponse | null
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to add rate")
  }

  return payload
}

export async function updateAircraftChargeRate(input: {
  id: string
  flight_type_id: string
  rate_per_hour: number
  charge_hobbs: boolean
  charge_tacho: boolean
  charge_airswitch: boolean
}) {
  const response = await fetch("/api/aircraft-charge-rates", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  const payload = (await response.json().catch(() => null)) as AircraftChargeRateResponse | ErrorResponse | null
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to update rate")
  }

  return payload
}

export async function deleteAircraftChargeRate(id: string) {
  const response = await fetch("/api/aircraft-charge-rates", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })

  const payload = (await response.json().catch(() => null)) as ErrorResponse | null
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to delete rate")
  }
}
