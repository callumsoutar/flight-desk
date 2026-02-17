import type { BookingWithRelations } from "@/lib/types/bookings"

export type MemberFlightHistoryEntry = BookingWithRelations

export type MemberFlightHistoryResponse = {
  flights: MemberFlightHistoryEntry[]
}
