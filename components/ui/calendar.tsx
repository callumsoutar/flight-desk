"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CalendarMode = "single"

type CalendarProps = {
  mode?: CalendarMode
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  initialFocus?: boolean
  className?: string
  disabled?: (date: Date) => boolean
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0)
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function firstOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0)
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function getMonthLabel(value: Date) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(value)
}

function buildMonthGrid(month: Date) {
  const monthStart = firstOfMonth(month)
  const startWeekday = monthStart.getDay()
  const gridStart = addDays(monthStart, -startWeekday)

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index)
    const outside = date.getMonth() !== monthStart.getMonth()
    return { date, outside }
  })

  return { monthStart, days }
}

export function Calendar({ selected, onSelect, initialFocus, className, disabled }: CalendarProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const today = React.useMemo(() => startOfDay(new Date()), [])
  const selectedDay = React.useMemo(() => (selected ? startOfDay(selected) : undefined), [selected])

  const [month, setMonth] = React.useState(() => firstOfMonth(selected ?? new Date()))

  React.useEffect(() => {
    if (!selected) return
    const nextMonth = firstOfMonth(selected)
    setMonth((prev) => (prev.getTime() === nextMonth.getTime() ? prev : nextMonth))
  }, [selected])

  React.useEffect(() => {
    if (!initialFocus) return
    const root = containerRef.current
    if (!root) return
    const target =
      root.querySelector<HTMLButtonElement>('button[data-selected="true"]') ??
      root.querySelector<HTMLButtonElement>('button[data-today="true"]')
    target?.focus()
  }, [initialFocus, month, selected])

  const { monthStart, days } = React.useMemo(() => buildMonthGrid(month), [month])

  const handlePreviousMonth = React.useCallback(() => {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1, 0, 0, 0, 0))
  }, [])

  const handleNextMonth = React.useCallback(() => {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1, 0, 0, 0, 0))
  }, [])

  return (
    <div ref={containerRef} className={cn("p-3", className)}>
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <button
          type="button"
          onClick={handlePreviousMonth}
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100"
          )}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="text-sm font-medium">{getMonthLabel(monthStart)}</div>

        <button
          type="button"
          onClick={handleNextMonth}
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100"
          )}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="flex h-9 items-center justify-center font-medium">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, outside }) => {
          const dayStart = startOfDay(date)
          const isSelected = selectedDay ? isSameDay(dayStart, selectedDay) : false
          const isToday = isSameDay(dayStart, today)
          const isDisabled = disabled?.(dayStart) ?? false

          return (
            <button
              key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
              type="button"
              data-selected={isSelected ? "true" : "false"}
              data-today={isToday ? "true" : "false"}
              onClick={() => {
                if (isDisabled) return
                onSelect?.(dayStart)
                if (outside) {
                  setMonth(firstOfMonth(dayStart))
                }
              }}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "h-9 w-9 rounded-md p-0 font-normal aria-selected:opacity-100",
                outside && "text-muted-foreground/50",
                isToday && !isSelected && "bg-accent text-accent-foreground",
                isSelected &&
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                isDisabled && "pointer-events-none opacity-40"
              )}
              aria-label={new Intl.DateTimeFormat(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              }).format(dayStart)}
              aria-pressed={isSelected}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
