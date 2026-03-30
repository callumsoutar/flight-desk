import type { BookingStatus, BookingType } from "@/lib/types/bookings"

export type DashboardDirectoryUserLite = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

export type DashboardAircraftLite = {
  id: string
  registration: string | null
  type: string | null
  model: string | null
  manufacturer: string | null
}

export type DashboardInstructorLite = {
  id: string
  first_name: string | null
  last_name: string | null
  user: DashboardDirectoryUserLite | null
}

export type DashboardBookingLite = {
  id: string
  start_time: string
  end_time: string
  status: BookingStatus
  booking_type: BookingType
  purpose: string | null
  user_id: string | null
  instructor_id: string | null
  aircraft_id: string | null
  student: DashboardDirectoryUserLite | null
  instructor: DashboardInstructorLite | null
  aircraft: DashboardAircraftLite | null
}

export type DashboardAircraftStatus = {
  id: string
  registration: string
  type: string | null
  model: string | null
  manufacturer: string | null
  openObservations: number
  isFlying: boolean
}

export type DashboardMetrics = {
  monthLabel: string
  hoursFlownThisMonth: number
  flightsThisMonth: number
  activeStudentsThisMonth: number
  avgFlightsPerDayThisMonth: number
  upcomingToday: number
  flyingNow: number
  bookingRequests: number
  fleetAttention: number
}

/** Staff: remainder of today; member/student: future confirmed schedule (excludes unconfirmed). */
export type DashboardViewerKind = "staff" | "member"

export type DashboardMemberCompliance = {
  /** Earliest relevant medical due date (certificate or class due dates). */
  medicalDue: string | null
  bfrDue: string | null
}

export type DashboardData = {
  tenantName: string
  timeZone: string
  nowIso: string
  viewerKind: DashboardViewerKind
  /** Pilot currency — only populated for member/student viewers. */
  memberCompliance: DashboardMemberCompliance | null
  metrics: DashboardMetrics
  bookingRequests: DashboardBookingLite[]
  flyingNowBookings: DashboardBookingLite[]
  upcomingBookings: DashboardBookingLite[]
  aircraftStatus: DashboardAircraftStatus[]
}

