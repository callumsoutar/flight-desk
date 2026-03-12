import type { Json } from "@/lib/types"
import { isJsonObject } from "@/lib/settings/utils"

export type MembershipYear = {
  start_month: number
  end_month: number
  start_day: number
  end_day: number
  description: string
}

export type MembershipsSettings = {
  membership_year: MembershipYear
}

export const DEFAULT_MEMBERSHIP_YEAR: MembershipYear = {
  start_month: 4,
  end_month: 3,
  start_day: 1,
  end_day: 31,
  description: "Membership year runs from April 1st to March 31st",
}

export const DEFAULT_MEMBERSHIPS_SETTINGS: MembershipsSettings = {
  membership_year: DEFAULT_MEMBERSHIP_YEAR,
}

function normalizeIntInRange(value: unknown, fallback: number, min: number, max: number) {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN
  if (!Number.isFinite(raw)) return fallback
  const rounded = Math.round(raw)
  if (rounded < min || rounded > max) return fallback
  return rounded
}

function daysInMonth(month: number, year = 2001) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function computeMembershipYearEnd(startMonth: number, startDay: number) {
  const maxDay = daysInMonth(startMonth)
  const clampedDay = Math.min(Math.max(1, startDay), maxDay)
  const start = new Date(Date.UTC(2001, startMonth - 1, clampedDay))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() - 1)
  return { end_month: end.getUTCMonth() + 1, end_day: end.getUTCDate() }
}

export function resolveMembershipsSettings(settings: Json | null | undefined): MembershipsSettings {
  const fallback = DEFAULT_MEMBERSHIPS_SETTINGS
  if (!isJsonObject(settings)) return fallback

  const rawMembershipYear = settings.membership_year
  const year = isJsonObject(rawMembershipYear) ? rawMembershipYear : null

  const start_month = normalizeIntInRange(year?.start_month, fallback.membership_year.start_month, 1, 12)
  const start_day = normalizeIntInRange(year?.start_day, fallback.membership_year.start_day, 1, 31)

  const { end_month, end_day } = computeMembershipYearEnd(start_month, start_day)

  const description =
    typeof year?.description === "string" && year.description.trim().length
      ? year.description.trim()
      : fallback.membership_year.description

  return {
    membership_year: {
      start_month,
      start_day,
      end_month,
      end_day,
      description,
    },
  }
}

