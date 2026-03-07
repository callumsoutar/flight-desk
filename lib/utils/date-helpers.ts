import { getZonedYyyyMmDdAndHHmm } from "@/lib/utils/timezone"

export function parseIsoOrNull(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function toIsoDateString(date: Date, timeZone: string): string {
  return getZonedYyyyMmDdAndHHmm(date, timeZone).yyyyMmDd
}
