"use client"

import * as React from "react"

export type BookingAvailabilityResponse = {
  unavailableAircraftIds: string[]
  unavailableInstructorIds: string[]
}

export type BookingOccurrence = {
  date: Date
  startIso: string
  endIso: string
}

export type BookingOccurrenceConflict = {
  aircraft: boolean
  instructor: boolean
}

async function fetchBookingAvailability(
  startIso: string,
  endIso: string,
  signal?: AbortSignal
): Promise<BookingAvailabilityResponse> {
  const params = new URLSearchParams({
    start_time: startIso,
    end_time: endIso,
  })

  const response = await fetch(`/api/bookings/availability?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
    signal,
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || "Failed to check availability")
  }

  const payload = (await response.json().catch(() => null)) as BookingAvailabilityResponse | null
  return {
    unavailableAircraftIds: payload?.unavailableAircraftIds ?? [],
    unavailableInstructorIds: payload?.unavailableInstructorIds ?? [],
  }
}

export function useBookingAvailability(params: {
  open: boolean
  isValidTimeRange: boolean
  startIso: string | null
  endIso: string | null
  recurringEnabled: boolean
  occurrences: BookingOccurrence[]
  aircraftId: string | null
  instructorId: string | null
}) {
  const {
    open,
    isValidTimeRange,
    startIso,
    endIso,
    recurringEnabled,
    occurrences,
    aircraftId,
    instructorId,
  } = params

  const [unavailableAircraftIds, setUnavailableAircraftIds] = React.useState<string[]>([])
  const [unavailableInstructorIds, setUnavailableInstructorIds] = React.useState<string[]>([])
  const [overlapsFetching, setOverlapsFetching] = React.useState(false)
  const [overlapsError, setOverlapsError] = React.useState<string | null>(null)
  const [occurrenceConflicts, setOccurrenceConflicts] = React.useState<Record<string, BookingOccurrenceConflict>>({})
  const [checkingOccurrences, setCheckingOccurrences] = React.useState(false)

  React.useEffect(() => {
    if (!open || !isValidTimeRange || !startIso || !endIso) {
      setUnavailableAircraftIds([])
      setUnavailableInstructorIds([])
      setOverlapsError(null)
      setOverlapsFetching(false)
      return
    }

    const controller = new AbortController()

    setOverlapsFetching(true)
    setOverlapsError(null)

    void fetchBookingAvailability(startIso, endIso, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return
        setUnavailableAircraftIds(payload.unavailableAircraftIds)
        setUnavailableInstructorIds(payload.unavailableInstructorIds)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setUnavailableAircraftIds([])
        setUnavailableInstructorIds([])
        setOverlapsError(error instanceof Error ? error.message : "Failed to check availability")
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setOverlapsFetching(false)
        }
      })

    return () => controller.abort()
  }, [open, isValidTimeRange, startIso, endIso])

  React.useEffect(() => {
    if (!open || !recurringEnabled || occurrences.length === 0) {
      setOccurrenceConflicts({})
      setCheckingOccurrences(false)
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      const check = async () => {
        setCheckingOccurrences(true)
        const conflicts: Record<string, BookingOccurrenceConflict> = {}

        try {
          await Promise.all(
            occurrences.map(async (occ) => {
              const payload = await fetchBookingAvailability(occ.startIso, occ.endIso)

              const aircraftConflict = aircraftId ? payload.unavailableAircraftIds.includes(aircraftId) : false
              const instructorConflict = instructorId
                ? payload.unavailableInstructorIds.includes(instructorId)
                : false

              if (aircraftConflict || instructorConflict) {
                conflicts[occ.startIso] = { aircraft: aircraftConflict, instructor: instructorConflict }
              }
            })
          )

          if (!cancelled) {
            setOccurrenceConflicts(conflicts)
          }
        } finally {
          if (!cancelled) {
            setCheckingOccurrences(false)
          }
        }
      }

      void check()
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, recurringEnabled, occurrences, aircraftId, instructorId])

  return {
    unavailableAircraftIds,
    unavailableInstructorIds,
    overlapsFetching,
    overlapsError,
    occurrenceConflicts,
    checkingOccurrences,
    hasConflicts: Object.keys(occurrenceConflicts).length > 0,
  }
}
