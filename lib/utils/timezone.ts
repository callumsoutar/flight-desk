const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_HHMM_PATTERN = /^\d{2}:\d{2}$/

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function parseDateKey(dateYyyyMmDd: string) {
  if (!DATE_KEY_PATTERN.test(dateYyyyMmDd)) return null

  const [yearString, monthString, dayString] = dateYyyyMmDd.split("-")
  const year = Number(yearString)
  const month = Number(monthString)
  const day = Number(dayString)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null

  const probe = new Date(Date.UTC(year, month - 1, day))
  const isValid =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  if (!isValid) return null

  return { year, month, day }
}

function parseTimeHHmm(timeHHmm: string) {
  if (!TIME_HHMM_PATTERN.test(timeHHmm)) return null

  const [hourString, minuteString] = timeHHmm.split(":")
  const hour = Number(hourString)
  const minute = Number(minuteString)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null

  return { hour, minute }
}

function dayNumberFromDateKey(dateYyyyMmDd: string) {
  const parsed = parseDateKey(dateYyyyMmDd)
  if (!parsed) throw new Error(`Invalid date key: ${dateYyyyMmDd}`)
  return Math.floor(Date.UTC(parsed.year, parsed.month - 1, parsed.day) / 86_400_000)
}

const zonedPartsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function getZonedPartsFormatter(timeZone: string) {
  const existing = zonedPartsFormatterCache.get(timeZone)
  if (existing) return existing

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })

  zonedPartsFormatterCache.set(timeZone, formatter)
  return formatter
}

function partsToObject(parts: Intl.DateTimeFormatPart[]) {
  let year = ""
  let month = ""
  let day = ""
  let hour = ""
  let minute = ""

  for (const part of parts) {
    if (part.type === "year") year = part.value
    if (part.type === "month") month = part.value
    if (part.type === "day") day = part.value
    if (part.type === "hour") hour = part.value
    if (part.type === "minute") minute = part.value
  }

  return {
    yyyyMmDd: `${year}-${month}-${day}`,
    hhmm: `${hour}:${minute}`,
  }
}

export function getZonedYyyyMmDdAndHHmm(date: Date, timeZone: string) {
  const formatter = getZonedPartsFormatter(timeZone)
  return partsToObject(formatter.formatToParts(date))
}

export function isValidDateKey(dateYyyyMmDd: string) {
  return parseDateKey(dateYyyyMmDd) !== null
}

export function resolveDateKey(input: string | null | undefined, timeZone: string) {
  if (input && isValidDateKey(input)) return input
  return zonedTodayYyyyMmDd(timeZone)
}

export function addDaysYyyyMmDd(dateYyyyMmDd: string, days: number) {
  const parsed = parseDateKey(dateYyyyMmDd)
  if (!parsed) throw new Error(`Invalid date key: ${dateYyyyMmDd}`)

  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`
}

export function zonedTodayYyyyMmDd(timeZone: string) {
  return getZonedYyyyMmDdAndHHmm(new Date(), timeZone).yyyyMmDd
}

export function dayOfWeekFromYyyyMmDd(dateYyyyMmDd: string) {
  const parsed = parseDateKey(dateYyyyMmDd)
  if (!parsed) throw new Error(`Invalid date key: ${dateYyyyMmDd}`)
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0)).getUTCDay()
}

export function zonedDateTimeToUtc({
  dateYyyyMmDd,
  timeHHmm,
  timeZone,
}: {
  dateYyyyMmDd: string
  timeHHmm: string
  timeZone: string
}) {
  const date = parseDateKey(dateYyyyMmDd)
  if (!date) throw new Error(`Invalid date key: ${dateYyyyMmDd}`)

  const time = parseTimeHHmm(timeHHmm)
  if (!time) throw new Error(`Invalid HH:mm time: ${timeHHmm}`)

  let utcMs = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, 0, 0)
  const targetDayNumber = dayNumberFromDateKey(dateYyyyMmDd)
  const targetMinutes = time.hour * 60 + time.minute

  // Iteratively converge on the UTC instant that formats to this local wall-clock time.
  for (let i = 0; i < 4; i += 1) {
    const actual = getZonedYyyyMmDdAndHHmm(new Date(utcMs), timeZone)
    const actualDayNumber = dayNumberFromDateKey(actual.yyyyMmDd)
    const [actualHour, actualMinute] = actual.hhmm.split(":").map(Number)
    const actualMinutes = actualHour * 60 + actualMinute

    const minuteDelta = (actualDayNumber - targetDayNumber) * 1_440 + (actualMinutes - targetMinutes)
    if (minuteDelta === 0) break
    utcMs -= minuteDelta * 60_000
  }

  return new Date(utcMs)
}

export function zonedDayRangeUtcIso({
  dateYyyyMmDd,
  timeZone,
}: {
  dateYyyyMmDd: string
  timeZone: string
}) {
  const startUtc = zonedDateTimeToUtc({
    dateYyyyMmDd,
    timeHHmm: "00:00",
    timeZone,
  })
  const endUtc = zonedDateTimeToUtc({
    dateYyyyMmDd: addDaysYyyyMmDd(dateYyyyMmDd, 1),
    timeHHmm: "00:00",
    timeZone,
  })

  return {
    startUtcIso: startUtc.toISOString(),
    endUtcIso: endUtc.toISOString(),
  }
}
