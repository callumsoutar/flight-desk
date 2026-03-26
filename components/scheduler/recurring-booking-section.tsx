"use client"

import * as React from "react"
import { AlertCircle, CalendarIcon, Check } from "lucide-react"

import { formatDate } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"

type OccurrenceConflict = {
  aircraft: boolean
  instructor: boolean
}

type RecurringBookingSectionProps = {
  isRecurring: boolean
  date: Date
  repeatUntil: Date | null
  recurringDays: number[]
  timeZone: string
  checkingOccurrences: boolean
  occurrences: Array<{
    startIso: string
    date: Date
  }>
  occurrenceConflicts: Record<string, OccurrenceConflict | undefined>
  recurringDaysError?: string
  repeatUntilError?: string
  onRecurringToggle: (checked: boolean) => void
  onRecurringDaysChange: (days: number[]) => void
  onRepeatUntilChange: (value: Date | null) => void
}

function formatEeeDdMmm(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone,
  }).format(value)
}

export function RecurringBookingSection({
  isRecurring,
  date,
  repeatUntil,
  recurringDays,
  timeZone,
  checkingOccurrences,
  occurrences,
  occurrenceConflicts,
  recurringDaysError,
  repeatUntilError,
  onRecurringToggle,
  onRecurringDaysChange,
  onRepeatUntilChange,
}: RecurringBookingSectionProps) {
  const hasConflicts = occurrences.some((occurrence) => Boolean(occurrenceConflicts[occurrence.startIso]))

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor="recurring" className="text-sm font-semibold text-slate-900">Recurring booking</Label>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            Repeat this booking automatically
          </p>
        </div>
        <Switch id="recurring" checked={isRecurring} onCheckedChange={onRecurringToggle} />
      </div>

      {isRecurring ? (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Repeat on</Label>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => {
                const isSelected = recurringDays.includes(index)
                return (
                  <Button
                    key={day}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "h-9 w-full rounded-xl p-0 text-[10px] font-bold transition-all",
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                        : "border-slate-200 text-slate-600 shadow-none hover:border-slate-300 hover:bg-slate-50"
                    )}
                    onClick={() => {
                      if (isSelected) {
                        onRecurringDaysChange(recurringDays.filter((value) => value !== index))
                        return
                      }

                      onRecurringDaysChange([...recurringDays, index])
                    }}
                  >
                    <span className="sm:hidden">{day.charAt(0)}</span>
                    <span className="hidden sm:inline">{day}</span>
                  </Button>
                )
              })}
            </div>
            {recurringDaysError ? <p className="text-[10px] font-medium text-destructive">{recurringDaysError}</p> : null}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50/60 p-3 ring-1 ring-slate-100">
            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Until date</Label>
              <p className="text-[10px] font-medium text-slate-500">Last occurrence</p>
            </div>
            <div className="w-[140px]">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-9 w-full justify-start rounded-lg border-slate-200 bg-white px-2.5 text-xs font-bold shadow-none transition-colors hover:bg-slate-50 focus:ring-0",
                      !repeatUntil && "text-slate-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{repeatUntil ? formatDate(repeatUntil, timeZone) : "End date"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto rounded-2xl border-slate-200 p-0 shadow-2xl" align="end">
                  <Calendar
                    mode="single"
                    selected={repeatUntil ?? undefined}
                    onSelect={(value) => {
                      if (!value) {
                        onRepeatUntilChange(null)
                        return
                      }

                      const day = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0)
                      const startDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
                      onRepeatUntilChange(day > startDay ? value : null)
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {repeatUntilError ? <p className="text-[10px] font-medium text-destructive">{repeatUntilError}</p> : null}

          {occurrences.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700">
                  Occurrences ({occurrences.length})
                </span>
                {checkingOccurrences ? (
                  <span className="animate-pulse text-[10px] text-slate-500">Checking availability...</span>
                ) : null}
              </div>

              {hasConflicts ? (
                <div className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs font-bold">Conflicting Occurrences</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-destructive/80">
                    Bookings will be skipped for the occurrences below. All other occurrences will still be created.
                  </p>
                  <div className="max-h-[160px] space-y-1 overflow-y-auto pr-2">
                    {occurrences.map((occurrence) => {
                      const conflict = occurrenceConflicts[occurrence.startIso]
                      if (!conflict) return null

                      return (
                        <div key={occurrence.startIso} className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2 text-[10px] ring-1 ring-destructive/10">
                          <span className="font-semibold text-slate-700">{formatEeeDdMmm(occurrence.date, timeZone)}</span>
                          <div className="flex gap-2">
                            {conflict.aircraft ? (
                              <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-bold uppercase tracking-wider text-destructive">Aircraft Conflict</span>
                            ) : null}
                            {conflict.instructor ? (
                              <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-bold uppercase tracking-wider text-destructive">Instructor Conflict</span>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : occurrences.length > 1 ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-emerald-700">
                  <Check className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium">All {occurrences.length} occurrences are available</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
