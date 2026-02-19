import type { TimelineConfig } from "@/lib/types/roster"

export function withTime(baseDate: Date, hours: number, minutes: number) {
  const next = new Date(baseDate)
  next.setHours(hours, minutes, 0, 0)
  return next
}

export function formatTimeLabel(value: Date) {
  return value.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function buildTimeSlots(date: Date, config: TimelineConfig) {
  const safeInterval = Math.max(5, config.intervalMinutes)
  const safeStartHour = Math.max(0, Math.min(23, Math.floor(config.startHour)))
  const safeEndHour = Math.max(safeStartHour + 1, Math.min(24, Math.ceil(config.endHour)))

  const start = withTime(date, safeStartHour, 0)
  const end = withTime(date, safeEndHour, 0)

  const slots: Date[] = []
  for (let time = start.getTime(); time < end.getTime(); time += safeInterval * 60_000) {
    slots.push(new Date(time))
  }

  return {
    slots,
    start,
    end,
  }
}

export function getBookingLayout({
  bookingStart,
  bookingEnd,
  timelineStart,
  timelineEnd,
}: {
  bookingStart: Date
  bookingEnd: Date
  timelineStart: Date
  timelineEnd: Date
}) {
  const timelineDuration = timelineEnd.getTime() - timelineStart.getTime()
  if (timelineDuration <= 0) return null

  const start = Math.max(bookingStart.getTime(), timelineStart.getTime())
  const end = Math.min(bookingEnd.getTime(), timelineEnd.getTime())
  if (end <= start) return null

  return {
    leftPct: ((start - timelineStart.getTime()) / timelineDuration) * 100,
    widthPct: ((end - start) / timelineDuration) * 100,
  }
}
