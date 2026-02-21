import type { BookingStatus } from "@/lib/types/bookings"

export function getBookingOpenPath(bookingId: string, status: BookingStatus) {
  return status === "flying" ? `/bookings/checkout/${bookingId}` : `/bookings/${bookingId}`
}
