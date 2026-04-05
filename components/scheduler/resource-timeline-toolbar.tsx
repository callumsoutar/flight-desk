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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="inline-flex h-11 items-stretch rounded-md border border-border/70 bg-background shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-full w-11 rounded-none rounded-l-md border-r border-border/70 text-muted-foreground hover:bg-slate-50 hover:text-foreground"
            onClick={onPreviousDay}
            disabled={disablePreviousDay}
            aria-label="Previous day"
          >
          <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="h-full min-w-[240px] justify-start gap-3 rounded-none border-0 px-4 font-semibold text-foreground hover:bg-slate-50 sm:min-w-[260px]"
                aria-label="Select date"
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{selectedDateLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto rounded-md border-border/70 p-0 shadow-lg" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={onSelectDate}
                initialFocus
                disabled={calendarDisabled}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            className="h-full w-11 rounded-none rounded-r-md border-l border-border/70 text-muted-foreground hover:bg-slate-50 hover:text-foreground"
            onClick={onNextDay}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={onToday}
          className="h-11 rounded-md border-border/70 bg-background px-5 font-semibold shadow-sm hover:bg-slate-50"
        >
          Today
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          className="h-11 rounded-md bg-slate-900 px-5 font-semibold text-white shadow-sm hover:bg-slate-800"
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
