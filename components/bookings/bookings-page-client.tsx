"use client"

import * as React from "react"

import { BookingsTable } from "@/components/bookings/bookings-table"
import type {
  BookingsFilter,
  BookingStatus,
  BookingType,
  BookingWithRelations,
} from "@/lib/types/bookings"

function zonedYyyyMmDd(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  return formatter.format(date)
}

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

type Props = {
  bookings: BookingWithRelations[]
}

export function BookingsPageClient({ bookings }: Props) {
  const [activeTab, setActiveTab] = React.useState("all")
  const [filters, setFilters] = React.useState<BookingsFilter>({})

  const timeZone = "Pacific/Auckland"
  const todayKey = React.useMemo(() => zonedYyyyMmDd(new Date(), timeZone), [timeZone])

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

    return {
      all: source.length,
      today: source.filter((b) => zonedYyyyMmDd(new Date(b.start_time), timeZone) === todayKey).length,
      flying: source.filter((b) => b.status === "flying").length,
      unconfirmed: source.filter((b) => b.status === "unconfirmed").length,
    }
  }, [bookings, filters.search, searchAndFilterMatched, timeZone, todayKey])

  const filteredBookings = React.useMemo(() => {
    const source = searchAndFilterMatched

    if (filters.search) {
      return source
    }

    switch (activeTab) {
      case "today":
        return source.filter((b) => zonedYyyyMmDd(new Date(b.start_time), timeZone) === todayKey)
      case "flying":
        return source.filter((b) => b.status === "flying")
      case "unconfirmed":
        return source.filter((b) => b.status === "unconfirmed")
      default:
        return source
    }
  }, [activeTab, filters.search, searchAndFilterMatched, timeZone, todayKey])

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

  return (
    <BookingsTable
      bookings={filteredBookings}
      onFiltersChange={handleFiltersChange}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabCounts={tabCounts}
    />
  )
}
