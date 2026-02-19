"use client"

import * as React from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"

import { RosterShiftModal } from "@/components/rosters/roster-shift-modal"
import {
  buildTimeSlots,
  formatTimeLabel,
  getBookingLayout,
  withTime,
} from "@/components/scheduler/scheduler-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { RosterInstructor, RosterRule, TimelineConfig } from "@/lib/types/roster"

const ROW_HEIGHT = 44
const LEFT_COL_WIDTH = "w-[160px] sm:w-[220px]"

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDaysToDate(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toYyyyMmDd(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseTimeForDate(baseDate: Date, time: string) {
  const [hours, minutes] = time.split(":").map((value) => Number(value))
  return withTime(baseDate, hours || 0, minutes || 0)
}

function formatPageDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function formatInlineDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date)
}

interface DraftSlot {
  instructorId: string
  startTime: string
  endTime: string
  date: string
  dayOfWeek: number
  isRecurring?: boolean
}

export function RosterScheduler({
  initialInstructors,
  initialRosterRules,
  timelineConfig,
}: {
  initialInstructors: RosterInstructor[]
  initialRosterRules: RosterRule[]
  timelineConfig: TimelineConfig
}) {
  const [selectedDate, setSelectedDate] = React.useState(() => startOfDay(new Date()))
  const [draftSlot, setDraftSlot] = React.useState<DraftSlot | null>(null)
  const [editingRule, setEditingRule] = React.useState<RosterRule | null>(null)
  const [rosterRules, setRosterRules] = React.useState<RosterRule[]>(initialRosterRules)

  React.useEffect(() => {
    setRosterRules(initialRosterRules)
  }, [initialRosterRules])

  const { slots, start: timelineStart, end: timelineEnd } = React.useMemo(
    () => buildTimeSlots(selectedDate, timelineConfig),
    [selectedDate, timelineConfig]
  )

  const slotCount = slots.length
  const slotMinWidthPx = React.useMemo(() => {
    if (timelineConfig.intervalMinutes >= 30) return 42
    if (timelineConfig.intervalMinutes >= 20) return 36
    if (timelineConfig.intervalMinutes >= 15) return 33
    return 30
  }, [timelineConfig.intervalMinutes])
  const timelineMinWidth = slotCount > 0 ? slotCount * slotMinWidthPx : undefined

  const dayKey = toYyyyMmDd(selectedDate)
  const dayOfWeek = selectedDate.getDay()

  const instructorOptions = React.useMemo(
    () =>
      initialInstructors
        .map((instructor) => {
          const firstName = instructor.first_name?.trim() || instructor.user?.first_name?.trim() || ""
          const lastName = instructor.last_name?.trim() || instructor.user?.last_name?.trim() || ""
          const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()

          return {
            id: instructor.id,
            name: fullName || instructor.user?.email || "Instructor",
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [initialInstructors]
  )

  const dayLabel = formatPageDayLabel(selectedDate)

  const visibleShifts = React.useMemo(() => {
    return rosterRules.filter((rule) => {
      if (!rule.is_active || rule.voided_at) {
        return false
      }

      if (rule.day_of_week !== dayOfWeek) {
        return false
      }

      if (rule.effective_from && rule.effective_from > dayKey) return false
      if (rule.effective_until && rule.effective_until < dayKey) return false

      return true
    })
  }, [rosterRules, dayKey, dayOfWeek])

  const shiftsByInstructor = React.useMemo(() => {
    const map: Record<string, RosterRule[]> = {}

    visibleShifts.forEach((rule) => {
      if (!map[rule.instructor_id]) {
        map[rule.instructor_id] = []
      }
      map[rule.instructor_id].push(rule)
    })

    return map
  }, [visibleShifts])

  const handleDateChange = React.useCallback((deltaDays: number) => {
    setSelectedDate((prev) => addDaysToDate(prev, deltaDays))
    setDraftSlot(null)
    setEditingRule(null)
  }, [])

  const goToToday = React.useCallback(() => {
    setSelectedDate(startOfDay(new Date()))
    setDraftSlot(null)
    setEditingRule(null)
  }, [])

  const openDraft = React.useCallback((slot: DraftSlot) => {
    setDraftSlot(slot)
    setEditingRule(null)
  }, [])

  const handleShiftClick = React.useCallback((rule: RosterRule, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setEditingRule(rule)
    setDraftSlot(null)
  }, [])

  const handleRowClick = React.useCallback(
    (instructorId: string, clientX: number, containerWidth: number, containerLeft: number) => {
      if (slotCount <= 0) return

      const relativeX = Math.max(0, Math.min(clientX - containerLeft, containerWidth))
      const index = Math.floor((relativeX / containerWidth) * slotCount)
      const selectedSlotTime = slots[Math.min(index, slotCount - 1)] ?? timelineStart
      const endTimeCandidate = new Date(selectedSlotTime.getTime() + timelineConfig.intervalMinutes * 60_000)
      const endTime = endTimeCandidate > timelineEnd ? timelineEnd : endTimeCandidate

      openDraft({
        instructorId,
        startTime: formatTimeLabel(selectedSlotTime),
        endTime: formatTimeLabel(endTime),
        date: dayKey,
        dayOfWeek,
        isRecurring: true,
      })
    },
    [dayKey, dayOfWeek, openDraft, slotCount, slots, timelineEnd, timelineStart, timelineConfig.intervalMinutes]
  )

  const handleModalClose = React.useCallback(() => {
    setDraftSlot(null)
    setEditingRule(null)
  }, [])

  const handleRuleSaved = React.useCallback((rule: RosterRule) => {
    setRosterRules((prev) => {
      const next = prev.filter((item) => item.id !== rule.id)
      next.push(rule)
      next.sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week
        if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time)
        return a.instructor_id.localeCompare(b.instructor_id)
      })
      return next
    })
  }, [])

  const handleRuleDeleted = React.useCallback((ruleId: string) => {
    setRosterRules((prev) => prev.filter((rule) => rule.id !== ruleId))
    setEditingRule(null)
  }, [])

  const quickCreate = () => {
    if (!instructorOptions.length) {
      toast.error("Add an instructor before creating a roster entry.")
      return
    }

    openDraft({
      instructorId: instructorOptions[0].id,
      startTime: "09:00",
      endTime: "17:00",
      date: dayKey,
      dayOfWeek: selectedDate.getDay(),
      isRecurring: true,
    })
  }

  const renderRows = () => {
    if (!instructorOptions.length) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No instructors found. Add staff from the <span className="font-semibold text-primary">Staff</span> section
          before rostering.
        </div>
      )
    }

    return (
      <div>
        {instructorOptions.map((instructor) => (
          <RosterTimelineRow
            key={instructor.id}
            instructorId={instructor.id}
            instructorName={instructor.name}
            slots={slots}
            slotCount={slotCount}
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            rowHeight={ROW_HEIGHT}
            shifts={shiftsByInstructor[instructor.id] ?? []}
            onEmptySlotClick={(clientX, container) =>
              handleRowClick(instructor.id, clientX, container.clientWidth, container.getBoundingClientRect().left)
            }
            onShiftClick={handleShiftClick}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => handleDateChange(-1)} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dayKey}
              onChange={(event) => {
                if (!event.target.value) return
                const [year, month, day] = event.target.value.split("-").map((value) => Number(value))
                const next = new Date(year, (month || 1) - 1, day || 1)
                setSelectedDate(startOfDay(next))
              }}
              className="h-auto w-[9.5rem] border-0 bg-transparent p-0 shadow-none"
              aria-label="Select date"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => handleDateChange(1)} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={goToToday} className="hidden sm:inline-flex">
            Today
          </Button>
          <span className="w-full text-sm font-medium text-muted-foreground sm:w-auto">{dayLabel}</span>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <Button className="bg-slate-900 text-white font-semibold h-10 px-5 hover:bg-slate-800" onClick={quickCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New roster entry
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="flex">
          <div className={cn("shrink-0 border-r border-border/60 bg-muted/10", LEFT_COL_WIDTH)}>
            <div className="sticky top-0 z-30 flex h-10 items-center border-b border-border/60 bg-card/90 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Instructors
            </div>
            {instructorOptions.map((instructor) => (
              <div
                key={instructor.id}
                className="flex items-center border-b border-border/60 px-3 text-sm font-semibold text-foreground last:border-b-0"
                style={{ height: ROW_HEIGHT }}
              >
                {instructor.name}
              </div>
            ))}
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <div style={timelineMinWidth ? { minWidth: timelineMinWidth } : undefined}>
              <div className="sticky top-0 z-20 h-10 border-b border-border/60 bg-card/90 backdrop-blur">
                <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}>
                  {slots.map((slot) => (
                    <div
                      key={slot.getTime()}
                      className="flex items-center justify-center border-r last:border-r-0 px-0.5 text-[8px] text-muted-foreground sm:text-[9px]"
                    >
                      <span className="select-none whitespace-nowrap font-medium tabular-nums">{formatTimeLabel(slot)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {renderRows()}
            </div>
          </div>
        </div>

        {visibleShifts.length === 0 && instructorOptions.length > 0 && (
          <div className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
            No roster entries for {formatInlineDayLabel(selectedDate)}. Click a slot to add one.
          </div>
        )}
      </div>

      {draftSlot ? (
        <RosterShiftModal
          open
          mode="create"
          instructors={instructorOptions}
          initialValues={{
            instructor_id: draftSlot.instructorId,
            day_of_week: draftSlot.dayOfWeek,
            start_time: draftSlot.startTime,
            end_time: draftSlot.endTime,
            is_recurring: draftSlot.isRecurring ?? false,
            effective_from: draftSlot.date,
            effective_until: draftSlot.isRecurring ? "" : draftSlot.date,
            notes: null,
          }}
          onClose={handleModalClose}
          onSaved={handleRuleSaved}
        />
      ) : null}

      {editingRule ? (
        <RosterShiftModal
          open
          mode="edit"
          ruleId={editingRule.id}
          instructors={instructorOptions}
          initialValues={{
            instructor_id: editingRule.instructor_id,
            day_of_week: editingRule.day_of_week,
            start_time: editingRule.start_time.slice(0, 5),
            end_time: editingRule.end_time.slice(0, 5),
            is_recurring: Boolean(!editingRule.effective_until || editingRule.effective_until !== editingRule.effective_from),
            effective_from: editingRule.effective_from,
            effective_until: editingRule.effective_until ?? "",
            notes: editingRule.notes,
          }}
          onClose={handleModalClose}
          onSaved={handleRuleSaved}
          onDeleted={handleRuleDeleted}
        />
      ) : null}
    </div>
  )
}

function RosterTimelineRow({
  instructorId,
  instructorName,
  slots,
  slotCount,
  timelineStart,
  timelineEnd,
  rowHeight,
  shifts,
  onEmptySlotClick,
  onShiftClick,
}: {
  instructorId: string
  instructorName: string
  slots: Date[]
  slotCount: number
  timelineStart: Date
  timelineEnd: Date
  rowHeight: number
  shifts: RosterRule[]
  onEmptySlotClick: (clientX: number, container: HTMLDivElement) => void
  onShiftClick: (rule: RosterRule, event: React.MouseEvent) => void
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    onEmptySlotClick(event.clientX, containerRef.current)
  }

  const shiftElements = shifts.map((shift) => {
    const shiftStart = parseTimeForDate(timelineStart, shift.start_time)
    const shiftEnd = parseTimeForDate(timelineStart, shift.end_time)
    const layout = getBookingLayout({
      bookingStart: shiftStart,
      bookingEnd: shiftEnd,
      timelineStart,
      timelineEnd,
    })
    if (!layout) return null

    const isRecurring = !shift.effective_until || shift.effective_until !== shift.effective_from
    const background = isRecurring ? "from-emerald-600 to-emerald-500" : "from-sky-600 to-sky-500"

    return (
      <div
        key={shift.id}
        className="absolute inset-y-0 pointer-events-auto"
        style={{
          left: `${layout.leftPct}%`,
          width: `max(${layout.widthPct}%, 4%)`,
        }}
      >
        <button
          type="button"
          onClick={(event) => onShiftClick(shift, event)}
          className={cn(
            "h-full w-full rounded-md px-2 text-left text-xs font-semibold leading-tight text-white transition-shadow duration-200",
            "shadow-sm border border-white/30",
            `bg-gradient-to-r ${background}`
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{isRecurring ? "Recurring shift" : "One-off shift"}</span>
            <span className="text-[10px] opacity-80">
              {shift.start_time.slice(0, 5)}-{shift.end_time.slice(0, 5)}
            </span>
          </div>
          {shift.notes ? <p className="text-[10px] text-white/90 line-clamp-2 mt-1">{shift.notes}</p> : null}
        </button>
      </div>
    )
  })

  return (
    <div className="relative border-b border-border/60 last:border-b-0" style={{ height: rowHeight }}>
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-pointer"
        onClick={handleClick}
        aria-label={`Timeline row for ${instructorName}`}
      >
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}>
          {slots.map((slot, idx) => (
            <div
              key={`${instructorId}-${slot.toISOString()}`}
              className={cn(
                "border-r border-border/60 last:border-r-0",
                idx % 2 === 1 ? "bg-muted/[0.02]" : "",
                slot.getMinutes() === 0 ? "bg-muted/[0.04]" : ""
              )}
            />
          ))}
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none">{shiftElements}</div>
    </div>
  )
}
