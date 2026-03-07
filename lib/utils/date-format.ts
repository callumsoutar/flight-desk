const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getCachedFormatter(
  key: string,
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const existing = formatterCache.get(key)
  if (existing) return existing
  const formatter = new Intl.DateTimeFormat(locale, options)
  formatterCache.set(key, formatter)
  return formatter
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const LOCALE = "en-NZ"

export type DateStyle = "short" | "medium" | "long"
export type TimeStyle = "24h" | "12h"
export type DateTimeStyle = "short" | "medium"

export function formatDate(
  value: string | Date | null | undefined,
  timeZone: string,
  style: DateStyle = "medium"
): string {
  const date = toDate(value)
  if (!date) return ""

  const options: Intl.DateTimeFormatOptions = { timeZone }
  switch (style) {
    case "short":
      options.day = "2-digit"
      options.month = "short"
      break
    case "medium":
      options.day = "2-digit"
      options.month = "short"
      options.year = "numeric"
      break
    case "long":
      options.weekday = "long"
      options.day = "numeric"
      options.month = "long"
      options.year = "numeric"
      break
  }

  return getCachedFormatter(`date:${style}:${timeZone}`, LOCALE, options).format(date)
}

export function formatTime(
  value: string | Date | null | undefined,
  timeZone: string,
  style: TimeStyle = "24h"
): string {
  const date = toDate(value)
  if (!date) return ""

  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    ...(style === "24h" ? { hourCycle: "h23" } : { hour12: true }),
  }

  return getCachedFormatter(`time:${style}:${timeZone}`, LOCALE, options).format(date)
}

export function formatDateTime(
  value: string | Date | null | undefined,
  timeZone: string,
  style: DateTimeStyle = "medium"
): string {
  const date = toDate(value)
  if (!date) return ""

  const options: Intl.DateTimeFormatOptions = { timeZone }
  switch (style) {
    case "short":
      options.day = "2-digit"
      options.month = "short"
      options.hour = "2-digit"
      options.minute = "2-digit"
      options.hourCycle = "h23"
      break
    case "medium":
      options.day = "2-digit"
      options.month = "short"
      options.year = "numeric"
      options.hour = "2-digit"
      options.minute = "2-digit"
      options.hourCycle = "h23"
      break
  }

  return getCachedFormatter(`datetime:${style}:${timeZone}`, LOCALE, options).format(date)
}

export function formatDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  timeZone: string,
  style: TimeStyle = "24h"
): string {
  return `${formatTime(start, timeZone, style)} – ${formatTime(end, timeZone, style)}`
}
