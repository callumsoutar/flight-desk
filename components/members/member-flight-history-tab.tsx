"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, Mail, Printer } from "lucide-react"
import {
  IconCalendar,
  IconChartBar,
  IconChevronDown,
  IconClock,
  IconPlane,
  IconSchool,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { useTimezone } from "@/contexts/timezone-context"
import {
  filterMemberFlightHistoryEntries,
  getAircraftLabel,
  getFlightDescription,
  getFlightHoursDisplay,
  getInstructorName,
} from "@/lib/flight-history/member-flight-history-summary"
import { sendMemberFlightHistorySummaryEmail, useMemberFlightHistoryQuery } from "@/hooks/use-member-flight-history-query"
import type { MemberFlightHistoryEntry } from "@/lib/types/flight-history"
import { formatDate as formatDateTz } from "@/lib/utils/date-format"

export type MemberFlightHistoryTabProps = {
  memberId: string
  memberEmail?: string | null
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

function toInputDate(value: Date): string {
  const yyyy = value.getFullYear()
  const mm = String(value.getMonth() + 1).padStart(2, "0")
  const dd = String(value.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
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

export function MemberFlightHistoryTab({ memberId, memberEmail }: MemberFlightHistoryTabProps) {
  const { timeZone } = useTimezone()
  const {
    data: historyData,
    isLoading,
    error,
  } = useMemberFlightHistoryQuery(memberId)
  const allFlights = React.useMemo<MemberFlightHistoryEntry[]>(
    () => historyData?.flights ?? [],
    [historyData?.flights]
  )

  const [dateFrom, setDateFrom] = React.useState<Date>(() => startOfDay(subDays(new Date(), 30)))
  const [dateTo, setDateTo] = React.useState<Date>(() => endOfDay(new Date()))
  const [isEmailing, setIsEmailing] = React.useState(false)
  const [isOpeningPdf, setIsOpeningPdf] = React.useState(false)

  const fromInput = toInputDate(dateFrom)
  const toInput = toInputDate(dateTo)

  const handlePresetClick = (days: number) => {
    setDateFrom(startOfDay(subDays(new Date(), days)))
    setDateTo(endOfDay(new Date()))
  }

  const flights = React.useMemo(() => {
    return filterMemberFlightHistoryEntries(allFlights, fromInput, toInput, timeZone)
  }, [allFlights, fromInput, toInput, timeZone])

  const totalFlightHours = flights.reduce((total, flight) => {
    const value = flight.billing_hours
    if (value == null) return total
    const hours = typeof value === "string" ? Number(value) : value
    return total + (Number.isFinite(hours) ? hours : 0)
  }, 0)
  const avgHoursPerFlight = flights.length > 0 ? totalFlightHours / flights.length : 0
  const canEmailSummary = Boolean(memberEmail?.trim()) && !isLoading && !isEmailing

  const handleEmailSummary = async () => {
    if (!canEmailSummary) return

    setIsEmailing(true)
    try {
      await sendMemberFlightHistorySummaryEmail({
        memberId,
        fromDate: fromInput,
        toDate: toInput,
      })
      toast.success("Flight history summary emailed to member")
    } catch (sendError) {
      toast.error(
        sendError instanceof Error ? sendError.message : "Failed to send flight history summary email"
      )
    } finally {
      setIsEmailing(false)
    }
  }

  const handlePrintPdf = () => {
    if (!memberId || isLoading || isOpeningPdf) return

    setIsOpeningPdf(true)
    try {
      const params = new URLSearchParams({ from_date: fromInput, to_date: toInput })
      const nextWindow = window.open(
        `/api/members/${memberId}/flight-history-summary/pdf?${params.toString()}`,
        "_blank",
        "noopener,noreferrer"
      )

      if (!nextWindow) {
        toast.error("The PDF was blocked by your browser. Allow pop-ups and try again.")
      }
    } finally {
      window.setTimeout(() => setIsOpeningPdf(false), 250)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading flight history...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-destructive">
          {error instanceof Error ? error.message : "Failed to load flight history"}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3 shadow-sm sm:px-4">
        <div className="flex min-w-0 flex-row flex-nowrap items-center gap-3 overflow-x-auto sm:gap-4">
          <div className="flex shrink-0 gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(30)}
              className="border-slate-300 bg-white font-medium text-slate-800 shadow-sm hover:bg-slate-100 hover:text-slate-900"
            >
              30 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(90)}
              className="border-slate-300 bg-white font-medium text-slate-800 shadow-sm hover:bg-slate-100 hover:text-slate-900"
            >
              90 days
            </Button>
          </div>

          <div className="flex min-w-0 shrink-0 flex-row flex-nowrap items-center gap-2 sm:gap-3">
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
              className="h-9 w-[10.25rem] shrink-0 border-slate-300 bg-white text-slate-900 shadow-sm"
            />
            <span className="shrink-0 text-sm font-medium text-slate-600">to</span>
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
              className="h-9 w-[10.25rem] shrink-0 border-slate-300 bg-white text-slate-900 shadow-sm"
            />
          </div>

          <div className="ml-auto flex shrink-0 flex-row flex-nowrap items-center gap-2 sm:gap-3">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleEmailSummary()}
              disabled={!canEmailSummary}
              className="h-9 gap-1.5 bg-slate-900 px-3 font-semibold text-white shadow-sm hover:bg-slate-800 sm:px-4"
            >
              {isEmailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Email summary
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintPdf}
              disabled={!memberId || isLoading || isOpeningPdf}
              className="h-9 gap-1.5 border-slate-300 bg-white px-3 font-semibold text-slate-900 shadow-sm hover:bg-slate-100 hover:text-slate-900 sm:px-4"
            >
              {isOpeningPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Print PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col items-stretch gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex-row">
        <div className="flex flex-1 flex-col items-center justify-center">
          <IconPlane className="mb-1 h-6 w-6 text-indigo-600" />
          <div className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Total Flights</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{flights.length}</div>
        </div>
        <div className="mx-2 hidden w-px bg-slate-300 md:block" />
        <div className="flex flex-1 flex-col items-center justify-center">
          <IconClock className="mb-1 h-6 w-6 text-blue-600" />
          <div className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Total Hours</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{totalFlightHours.toFixed(1)}h</div>
        </div>
        <div className="mx-2 hidden w-px bg-slate-300 md:block" />
        <div className="flex flex-1 flex-col items-center justify-center">
          <IconChartBar className="mb-1 h-6 w-6 text-emerald-600" />
          <div className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Avg Hours / Flight</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{avgHoursPerFlight.toFixed(1)}h</div>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Aircraft</th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Instructor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Description</th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-600 uppercase">Flight Time</th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {flights.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-24 text-center font-medium text-slate-500">
                  No completed flights found in this date range.
                </td>
              </tr>
            ) : (
              flights.map((flight) => {
                const aircraftLabel = getAircraftLabel(flight)
                const description = getFlightDescription(flight)
                const isSolo = !flight.instructor

                return (
                  <tr key={flight.id} className="group transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 align-middle">
                      <span className="font-semibold text-slate-900">
                        {flight.end_time ? formatDateTz(flight.end_time, timeZone) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center gap-2">
                        <IconPlane className="h-4 w-4 text-slate-500" />
                        <span className="font-semibold text-slate-900">{aircraftLabel}</span>
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
                    <td className="max-w-[250px] px-4 py-3.5 align-middle">
                      <span className="block truncate text-sm text-slate-600" title={description}>
                        {description}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <span className="font-mono font-semibold text-slate-900">{getFlightHoursDisplay(flight)}h</span>
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
        {flights.length === 0 ? (
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
          flights.map((flight) => {
            const aircraftLabel = getAircraftLabel(flight)
            const description = getFlightDescription(flight)
            const isSolo = !flight.instructor

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
                      <IconPlane className="h-4 w-4 text-slate-500" />
                      <h3 className="font-semibold text-slate-900">{aircraftLabel}</h3>
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
                      {flight.end_time ? formatDateTz(flight.end_time, timeZone) : "—"}
                    </div>
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
                      <div className="text-sm font-semibold text-slate-700">{getInstructorName(flight)}</div>
                    </div>
                  ) : null}
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
