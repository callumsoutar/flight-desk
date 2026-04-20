"use client"

import { useQuery } from "@tanstack/react-query"

export type BookingOptions = {
  aircraft: Array<{
    id: string
    registration: string
    type: string
    aircraft_type_id: string | null
    model: string | null
    manufacturer: string | null
    prioritise_scheduling: boolean
  }>
  members: Array<{
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  }>
  instructors: Array<{
    id: string
    first_name: string | null
    last_name: string | null
    user_id: string | null
    is_actively_instructing?: boolean
    user: {
      id: string
      first_name: string | null
      last_name: string | null
      email: string
    } | null
  }>
  flightTypes: Array<{
    id: string
    name: string
    instruction_type: string | null
  }>
  syllabi: Array<{
    id: string
    name: string
  }>
  lessons: Array<{
    id: string
    name: string
    description: string | null
    order: number | null
    syllabus_id: string | null
  }>
}

type BookingOptionsResponse = {
  options: BookingOptions
}

export const bookingOptionsQueryKey = ["booking-options"] as const

async function fetchBookingOptions(): Promise<BookingOptions> {
  const response = await fetch("/api/bookings/options", {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || "Failed to load booking options")
  }

  const payload = (await response.json().catch(() => null)) as BookingOptionsResponse | null
  if (!payload?.options) {
    throw new Error("Failed to load booking options")
  }

  return payload.options
}

export function useBookingOptionsQuery(enabled: boolean) {
  return useQuery({
    queryKey: bookingOptionsQueryKey,
    queryFn: fetchBookingOptions,
    enabled,
    staleTime: 60 * 1000,
  })
}
