"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { updateBookingStatusAction } from "@/app/bookings/actions"
import { BookingsTable } from "@/components/bookings/bookings-table"
import { useTimezone } from "@/contexts/timezone-context"
import type {
  BookingsFilter,
  BookingStatus,
  BookingType,
  BookingWithRelations,
} from "@/lib/types/bookings"
import { getZonedYyyyMmDdAndHHmm } from "@/lib/utils/timezone"

function includesSearch(booking: BookingWithRelations, value: string | undefined) {
  const search = value?.trim().toLowerCase()
  if (!search) return true

  const aircraft = [
    booking.aircraft?.registration,
    booking.aircraft?.manufacturer,
    booking.aircraft?.type,
    booking.aircraft?.model,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const student = [booking.student?.first_name, booking.student?.last_name, booking.student?.email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const instructor = [
    booking.instructor?.user?.first_name ?? booking.instructor?.first_name,
    booking.instructor?.user?.last_name ?? booking.instructor?.last_name,
    booking.instructor?.user?.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const purpose = (booking.purpose ?? "").toLowerCase()

  return (
    aircraft.includes(search) ||
    student.includes(search) ||
    instructor.includes(search) ||
    purpose.includes(search)
  )
}

const VALID_TABS = ["all", "today", "flying", "unconfirmed"] as const

type Props = {
  bookings: BookingWithRelations[]
  /** Only staff can confirm unconfirmed bookings from this list. */
  isStaff: boolean
}

export function BookingsPageClient({ bookings, isStaff }: Props) {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get("tab")
  const initialTab =
    tabFromUrl && (VALID_TABS as readonly string[]).includes(tabFromUrl) ? tabFromUrl : "all"
  const [activeTab, setActiveTab] = React.useState(initialTab)
  const [filters, setFilters] = React.useState<BookingsFilter>({})
  const [optimisticallyApprovedIds, setOptimisticallyApprovedIds] = React.useState<Set<string>>(
    () => new Set()
  )

  const { timeZone } = useTimezone()
  const todayKey = React.useMemo(
    () => getZonedYyyyMmDdAndHHmm(new Date(), timeZone).yyyyMmDd,
    [timeZone]
  )

  const searchAndFilterMatched = React.useMemo(() => {
    return bookings.filter((booking) => {
      if (!includesSearch(booking, filters.search)) return false

      if (filters.status?.length && !filters.status.includes(booking.status)) {
        return false
      }

      if (filters.booking_type?.length && !filters.booking_type.includes(booking.booking_type)) {
        return false
      }

      return true
    })
  }, [bookings, filters.booking_type, filters.search, filters.status])

  const tabCounts = React.useMemo(() => {
    const source = filters.search ? searchAndFilterMatched : bookings
    const excludeApproved = (b: { id: string }) => !optimisticallyApprovedIds.has(b.id)

    return {
      all: source.length,
      today: source.filter((b) => getZonedYyyyMmDdAndHHmm(new Date(b.start_time), timeZone).yyyyMmDd === todayKey).length,
      flying: source.filter((b) => b.status === "flying").length,
      unconfirmed: source.filter((b) => b.status === "unconfirmed" && excludeApproved(b)).length,
    }
  }, [bookings, filters.search, searchAndFilterMatched, timeZone, todayKey, optimisticallyApprovedIds])

  const filteredBookings = React.useMemo(() => {
    const source = searchAndFilterMatched

    if (filters.search) {
      return source
    }

    let result: typeof source
    switch (activeTab) {
      case "today":
        result = source.filter((b) => getZonedYyyyMmDdAndHHmm(new Date(b.start_time), timeZone).yyyyMmDd === todayKey)
        break
      case "flying":
        result = source.filter((b) => b.status === "flying")
        break
      case "unconfirmed":
        result = source.filter((b) => b.status === "unconfirmed")
        break
      default:
        result = source
    }

    return result.filter((b) => !optimisticallyApprovedIds.has(b.id))
  }, [activeTab, filters.search, searchAndFilterMatched, timeZone, todayKey, optimisticallyApprovedIds])

  const handleFiltersChange = React.useCallback(
    (tableFilters: {
      search?: string
      status?: BookingStatus[]
      booking_type?: BookingType[]
    }) => {
      setFilters((prev) => ({
        ...prev,
        search: tableFilters.search,
        status: tableFilters.status,
        booking_type: tableFilters.booking_type,
      }))
    },
    []
  )

  const handleApprove = React.useCallback(async (bookingId: string) => {
    setOptimisticallyApprovedIds((prev) => new Set(prev).add(bookingId))
    const result = await updateBookingStatusAction(bookingId, "confirmed")
    if (!result.ok) {
      setOptimisticallyApprovedIds((prev) => {
        const next = new Set(prev)
        next.delete(bookingId)
        return next
      })
      toast.error(result.error)
      return
    }
    toast.success("Booking confirmed")
  }, [])

  return (
    <BookingsTable
      bookings={filteredBookings}
      onFiltersChange={handleFiltersChange}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabCounts={tabCounts}
      onApprove={activeTab === "unconfirmed" && isStaff ? handleApprove : undefined}
    />
  )
}
