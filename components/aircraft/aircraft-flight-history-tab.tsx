"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconCalendar,
  IconChartBar,
  IconChevronDown,
  IconClock,
  IconPlane,
  IconSchool,
  IconUser,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import type { FlightEntry } from "@/lib/types/aircraft-detail"

type Props = {
  flights: FlightEntry[]
}

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return ""
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "—"
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleTimeString("en-NZ", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function toInputDate(value: Date): string {
  const yyyy = value.getFullYear()
  const mm = String(value.getMonth() + 1).padStart(2, "0")
  const dd = String(value.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

type UserLite = {
  first_name: string | null
  last_name: string | null
  email?: string | null
}

function getUserName(user: UserLite | null | undefined): string {
  if (!user) return "—"
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ")
  return name || user.email || "—"
}

function getInstructorName(flight: FlightEntry): string {
  const instructor = flight.instructor
  if (!instructor) return "—"
  const firstName = instructor.user?.first_name ?? instructor.first_name
  const lastName = instructor.user?.last_name ?? instructor.last_name
  const fullName = [firstName, lastName].filter(Boolean).join(" ")
  return fullName || instructor.user?.email || "—"
}

function getFlightHours(flight: FlightEntry): number {
  const value = flight.billing_hours
  if (value == null) return 0
  const hours = typeof value === "string" ? Number(value) : value
  return Number.isFinite(hours) ? hours : 0
}

function getFlightHoursDisplay(flight: FlightEntry): string {
  const value = flight.billing_hours
  if (value == null) return "-"
  const raw = String(value)
  return raw.includes(".") ? raw : `${raw}.0`
}

export function AircraftFlightHistoryTab({ flights }: Props) {
  const [dateFrom, setDateFrom] = React.useState<Date>(() => startOfDay(subDays(new Date(), 30)))
  const [dateTo, setDateTo] = React.useState<Date>(() => endOfDay(new Date()))

  const handlePresetClick = (days: number) => {
    setDateFrom(startOfDay(subDays(new Date(), days)))
    setDateTo(endOfDay(new Date()))
  }

  const filteredFlights = React.useMemo(() => {
    return flights.filter((flight) => {
      const dateToCheck = flight.end_time || flight.created_at
      if (!dateToCheck) return false
      const flightDate = new Date(dateToCheck)
      if (Number.isNaN(flightDate.getTime())) return false
      return flightDate >= dateFrom && flightDate <= dateTo
    })
  }, [flights, dateFrom, dateTo])

  const totalFlightHours = filteredFlights.reduce((total, flight) => total + getFlightHours(flight), 0)
  const avgHoursPerFlight =
    filteredFlights.length > 0 ? totalFlightHours / filteredFlights.length : 0

  const fromInput = toInputDate(dateFrom)
  const toInput = toInputDate(dateTo)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">Flight History</h3>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(30)}
              className="flex-1 sm:flex-none"
            >
              30 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(90)}
              className="flex-1 sm:flex-none"
            >
              90 days
            </Button>
          </div>
          <div className="flex flex-1 items-center gap-2">
            <DatePicker
              date={fromInput}
              onChange={(value) => {
                if (!value) return
                const parsed = new Date(value)
                if (Number.isNaN(parsed.getTime())) return
                setDateFrom(startOfDay(parsed))
                if (parsed > dateTo) {
                  setDateTo(endOfDay(parsed))
                }
              }}
              className="h-9"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <DatePicker
              date={toInput}
              onChange={(value) => {
                if (!value) return
                const parsed = new Date(value)
                if (Number.isNaN(parsed.getTime())) return
                const nextTo = endOfDay(parsed)
                if (nextTo < dateFrom) return
                setDateTo(nextTo)
              }}
              className="h-9"
            />
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col items-stretch gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex-row">
        <div className="flex flex-1 flex-col items-center justify-center">
          <IconPlane className="mb-1 h-6 w-6 text-indigo-600" />
          <div className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
            Total Flights
          </div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{filteredFlights.length}</div>
        </div>
        <div className="mx-2 hidden w-px bg-slate-300 md:block" />
        <div className="flex flex-1 flex-col items-center justify-center">
          <IconClock className="mb-1 h-6 w-6 text-blue-600" />
          <div className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
            Total Hours
          </div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{totalFlightHours.toFixed(1)}h</div>
        </div>
        <div className="mx-2 hidden w-px bg-slate-300 md:block" />
        <div className="flex flex-1 flex-col items-center justify-center">
          <IconChartBar className="mb-1 h-6 w-6 text-emerald-600" />
          <div className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
            Avg Hours / Flight
          </div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{avgHoursPerFlight.toFixed(1)}h</div>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Member</th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Instructor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Description</th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">Hobbs Start</th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">Hobbs End</th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">Tach Start</th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">Tach End</th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-600 uppercase">Flight Time</th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredFlights.length === 0 ? (
              <tr>
                <td colSpan={10} className="h-24 text-center font-medium text-slate-500">
                  No completed flights found in this date range.
                </td>
              </tr>
            ) : (
              filteredFlights.map((flight) => {
                const flightDate = flight.end_time || flight.created_at
                const description =
                  flight.lesson?.name || flight.flight_type?.name || flight.purpose || "Flight"
                const isSolo = !flight.instructor

                return (
                  <tr key={flight.id} className="group transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">
                          {flightDate ? formatDate(flightDate) : "—"}
                        </span>
                        {flight.start_time && flight.end_time ? (
                          <span className="text-xs text-slate-500">
                            {formatTime(flight.start_time)}-{formatTime(flight.end_time)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center gap-2">
                        <IconUser className="h-4 w-4 text-slate-500" />
                        <span className="font-semibold text-slate-900">{getUserName(flight.student)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {isSolo ? (
                        <Badge
                          variant="outline"
                          className="border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                        >
                          Solo
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <IconSchool className="h-4 w-4 text-slate-500" />
                          <span className="font-medium text-slate-700">{getInstructorName(flight)}</span>
                        </div>
                      )}
                    </td>
                    <td className="max-w-[220px] px-4 py-3.5 align-middle">
                      <span className="block truncate text-sm text-slate-600" title={description}>
                        {description}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <span className="font-mono text-xs text-slate-900">
                        {flight.hobbs_start != null ? Number(flight.hobbs_start).toFixed(1) : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <span className="font-mono text-xs text-slate-900">
                        {flight.hobbs_end != null ? Number(flight.hobbs_end).toFixed(1) : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <span className="font-mono text-xs text-slate-900">
                        {flight.tach_start != null ? Number(flight.tach_start).toFixed(1) : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <span className="font-mono text-xs text-slate-900">
                        {flight.tach_end != null ? Number(flight.tach_end).toFixed(1) : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <span className="font-mono font-semibold text-slate-900">
                        {getFlightHoursDisplay(flight)}h
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <Button variant="outline" size="sm" asChild className="h-8 px-3 text-xs font-medium">
                        <Link href={`/bookings/${flight.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {filteredFlights.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center">
            <div className="mb-4 font-medium text-slate-500">No completed flights found</div>
            <Button asChild variant="outline" size="sm">
              <Link href="/bookings">
                <IconCalendar className="mr-2 h-4 w-4" />
                Schedule Flight
              </Link>
            </Button>
          </div>
        ) : (
          filteredFlights.map((flight) => {
            const flightDate = flight.end_time || flight.created_at
            const description =
              flight.lesson?.name || flight.flight_type?.name || flight.purpose || "Flight"
            const isSolo = !flight.instructor
            const memberName = getUserName(flight.student)

            return (
              <Link
                key={flight.id}
                href={`/bookings/${flight.id}`}
                className="relative block cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
              >
                <div className="absolute top-0 bottom-0 left-0 w-1 rounded-l-lg bg-indigo-600" />

                <div className="mb-3 flex items-start justify-between pl-2">
                  <div className="flex flex-col">
                    <div className="mb-1 flex items-center gap-2">
                      <IconUser className="h-4 w-4 text-slate-500" />
                      <h3 className="font-semibold text-slate-900">{memberName}</h3>
                    </div>
                    <span className="text-xs text-slate-600">{description}</span>
                  </div>
                  {isSolo ? (
                    <Badge
                      variant="outline"
                      className="border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                    >
                      Solo
                    </Badge>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <IconCalendar className="h-3 w-3" /> Date
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {flightDate ? formatDate(flightDate) : "—"}
                    </div>
                    {flight.start_time && flight.end_time ? (
                      <div className="text-xs text-slate-500">
                        {formatTime(flight.start_time)}-{formatTime(flight.end_time)}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <IconClock className="h-3 w-3" /> Flight Time
                    </div>
                    <div className="font-mono text-sm font-semibold text-slate-900">
                      {getFlightHoursDisplay(flight)}h
                    </div>
                  </div>
                  {!isSolo ? (
                    <div className="col-span-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        <IconSchool className="h-3 w-3" /> Instructor
                      </div>
                      <div className="text-sm font-semibold text-slate-700">
                        {getInstructorName(flight)}
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Hobbs Start
                    </div>
                    <div className="font-mono text-xs text-slate-700">
                      {flight.hobbs_start != null ? Number(flight.hobbs_start).toFixed(1) : "-"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Hobbs End
                    </div>
                    <div className="font-mono text-xs text-slate-700">
                      {flight.hobbs_end != null ? Number(flight.hobbs_end).toFixed(1) : "-"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Tach Start
                    </div>
                    <div className="font-mono text-xs text-slate-700">
                      {flight.tach_start != null ? Number(flight.tach_start).toFixed(1) : "-"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Tach End
                    </div>
                    <div className="font-mono text-xs text-slate-700">
                      {flight.tach_end != null ? Number(flight.tach_end).toFixed(1) : "-"}
                    </div>
                  </div>
                </div>

                <div className="absolute right-4 bottom-4">
                  <IconChevronDown className="h-4 w-4 -rotate-90 transform text-slate-400" />
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
