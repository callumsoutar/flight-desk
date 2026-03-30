"use client"

import * as React from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function ResourceTimelineToolbar({
  selectedDateLabel,
  selectedDate,
  onSelectDate,
  onPreviousDay,
  onNextDay,
  onToday,
  onNewBooking,
  disableNewBooking,
  disablePreviousDay,
  calendarDisabled,
}: {
  selectedDateLabel: string
  selectedDate?: Date
  onSelectDate: (value: Date | undefined) => void
  onPreviousDay: () => void
  onNextDay: () => void
  onToday: () => void
  onNewBooking: () => void
  disableNewBooking: boolean
  /** When true, user cannot move to the previous calendar day (e.g. members/students). */
  disablePreviousDay?: boolean
  /** Dates for which the popover calendar day cell is not selectable. */
  calendarDisabled?: (date: Date) => boolean
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onPreviousDay}
          disabled={disablePreviousDay}
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-10 flex-1 justify-start gap-2 px-3 font-semibold sm:flex-initial"
              aria-label="Select date"
            >
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{selectedDateLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={onSelectDate}
              initialFocus
              disabled={calendarDisabled}
            />
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="icon" onClick={onNextDay} aria-label="Next day">
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button variant="ghost" onClick={onToday} className="hidden sm:inline-flex">
          Today
        </Button>
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <Button
          className="h-10 bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800"
          onClick={onNewBooking}
          disabled={disableNewBooking}
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          New booking
        </Button>
      </div>
    </div>
  )
}
