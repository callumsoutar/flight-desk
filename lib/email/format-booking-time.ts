import { getZonedYyyyMmDdAndHHmm } from "@/lib/utils/timezone"

export function formatBookingDateRange(startIso: string, endIso: string, timezone: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const { hhmm: startTime } = getZonedYyyyMmDdAndHHmm(start, timezone)
  const { hhmm: endTime } = getZonedYyyyMmDdAndHHmm(end, timezone)

  const date = new Intl.DateTimeFormat("en-NZ", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(start)

  return {
    date,
    startTime,
    endTime,
    full: `${date}, ${startTime}-${endTime}`,
  }
}
