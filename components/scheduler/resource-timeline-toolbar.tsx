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
    <div className="flex max-w-full flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 max-w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
        <div className="inline-flex h-11 w-full min-w-0 max-w-full items-stretch overflow-hidden rounded-md border border-slate-200/80 bg-white sm:w-fit">
          <Button
            variant="ghost"
            size="icon"
            className="group h-full w-11 shrink-0 cursor-pointer rounded-none rounded-l-md border-r border-slate-200/70 bg-slate-50/90 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed"
            onClick={onPreviousDay}
            disabled={disablePreviousDay}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="h-full min-w-0 flex-1 justify-center gap-2 rounded-none border-0 bg-white/80 px-2 font-semibold text-foreground hover:bg-slate-50/90 sm:min-w-[240px] sm:flex-none sm:justify-start sm:gap-3 sm:px-4 md:min-w-[260px]"
                aria-label="Select date"
              >
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate text-center sm:text-left">{selectedDateLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto rounded-md border-slate-200/80 p-0 shadow-sm" align="start">
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
            className="group h-full w-11 shrink-0 cursor-pointer rounded-none rounded-r-md border-l border-slate-200/70 bg-slate-50/90 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            onClick={onNextDay}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={onToday}
          className="h-11 w-full shrink-0 whitespace-nowrap rounded-md border-slate-200/80 bg-white px-4 font-semibold hover:bg-slate-50/90 sm:w-auto sm:px-5"
        >
          Today
        </Button>
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <Button
          className="h-11 rounded-md bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800"
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
