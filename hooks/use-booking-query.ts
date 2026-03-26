"use client"

import { useQuery } from "@tanstack/react-query"

import type { BookingWithRelations } from "@/lib/types/bookings"
import type { BookingWarningsResponse } from "@/lib/types/booking-warnings"
import type { BookingStatus } from "@/lib/types/bookings"

type BookingQueryResponse = {
  booking: BookingWithRelations
}

type BookingApiErrorPayload = {
  error?: string
}

type BookingPatchPayload = {
  status?: BookingStatus
  cancellation_category_id?: string | null
  cancellation_reason?: string | null
  cancelled_notes?: string | null
  instructor_id?: string | null
  aircraft_id?: string | null
  start_time?: string
  end_time?: string
}

type CreateBookingPayload = {
  start_time: string
  end_time: string
  aircraft_id: string | null
  user_id?: string | null
  instructor_id: string | null
  flight_type_id?: string | null
  lesson_id?: string | null
  booking_type: "flight" | "groundwork" | "maintenance" | "other"
  purpose: string
  remarks?: string | null
  status?: "unconfirmed" | "confirmed"
}

type CreateTrialBookingPayload = {
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  guest_phone?: string
  voucher_number?: string
  start_time: string
  end_time: string
  aircraft_id: string | null
  instructor_id: string | null
  flight_type_id?: string | null
  purpose: string
  remarks?: string | null
  status?: "unconfirmed" | "confirmed"
}

type CreateRecurringBookingsPayload = Omit<CreateBookingPayload, "start_time" | "end_time"> & {
  occurrences: Array<{ start_time: string; end_time: string }>
}

type RecurringBookingsResponse = {
  requestedCount?: number
  createdCount?: number
  failedCount?: number
  created?: unknown[]
  failed?: Array<{ start_time: string; end_time: string; status: number; error: string }>
  error?: string
}

type CreateBookingResponse = {
  booking?: { id: string }
  error?: string
}

type CreateTrialBookingResponse = {
  booking?: { id: string }
  guestUserId?: string
  error?: string
}

function getBookingApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as BookingApiErrorPayload).error === "string"
    ? ((payload as BookingApiErrorPayload).error || fallback)
    : fallback
}

export function bookingQueryKey(bookingId: string) {
  return ["booking", bookingId] as const
}

async function fetchBooking(bookingId: string): Promise<BookingWithRelations> {
  const response = await fetch(`/api/bookings/${bookingId}`, {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || "Failed to load booking")
  }

  const payload = (await response.json().catch(() => null)) as BookingQueryResponse | null
  if (!payload?.booking) {
    throw new Error("Failed to load booking")
  }

  return payload.booking
}

export async function sendBookingConfirmationEmailMutation(bookingId: string) {
  const response = await fetch(`/api/bookings/${bookingId}/send-confirmation-email`, {
    method: "POST",
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as BookingApiErrorPayload | null
    throw new Error(payload?.error || "Failed to send confirmation email")
  }
}

export async function patchBookingMutation(bookingId: string, payload: BookingPatchPayload) {
  const response = await fetch(`/api/bookings/${bookingId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(getBookingApiError(body, "Failed to update booking"))
  }
}

export async function cancelBookingMutation(input: {
  bookingId: string
  cancellationCategoryId: string
  cancellationReason: string
  cancelledNotes: string | null
}) {
  await patchBookingMutation(input.bookingId, {
    status: "cancelled",
    cancellation_category_id: input.cancellationCategoryId,
    cancellation_reason: input.cancellationReason,
    cancelled_notes: input.cancelledNotes,
  })
}

export async function fetchBookingWarningsQuery(input: {
  bookingId: string
  userId: string | null
  instructorId: string | null
  aircraftId: string | null
  signal?: AbortSignal
}): Promise<BookingWarningsResponse> {
  const searchParams = new URLSearchParams()
  if (input.userId) searchParams.set("user_id", input.userId)
  if (input.instructorId) searchParams.set("instructor_id", input.instructorId)
  if (input.aircraftId) searchParams.set("aircraft_id", input.aircraftId)
  const query = searchParams.toString()
  const url = query.length > 0 ? `/api/bookings/${input.bookingId}/warnings?${query}` : `/api/bookings/${input.bookingId}/warnings`

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
    signal: input.signal,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getBookingApiError(payload, "Warning checks could not be refreshed for the current booking details."))
  }

  return (await response.json()) as BookingWarningsResponse
}

export async function createTrialBookingMutation(payload: CreateTrialBookingPayload) {
  const response = await fetch("/api/bookings/trial", {
    method: "POST",
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(payload),
  })
  const body = (await response.json().catch(() => null)) as CreateTrialBookingResponse | null
  if (!response.ok || !body?.booking) {
    throw new Error(body?.error || "Failed to create trial flight booking")
  }
  return body
}

export async function createRecurringBookingsMutation(payload: CreateRecurringBookingsPayload) {
  const response = await fetch("/api/bookings/recurring", {
    method: "POST",
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(payload),
  })

  return ((await response.json().catch(() => null)) ?? {}) as RecurringBookingsResponse
}

export async function createBookingMutation(payload: CreateBookingPayload) {
  const response = await fetch("/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(payload),
  })
  const body = (await response.json().catch(() => null)) as CreateBookingResponse | null
  if (!response.ok || !body?.booking) {
    throw new Error(body?.error || "Failed to create booking")
  }
  return body.booking
}

export function useBookingQuery(bookingId: string, initialData: BookingWithRelations) {
  return useQuery({
    queryKey: bookingQueryKey(bookingId),
    queryFn: () => fetchBooking(bookingId),
    initialData,
    staleTime: 30 * 1000,
  })
}
