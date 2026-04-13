import type {
  MembershipYearSettings,
  MembershipRecord,
  MembershipStatus,
} from "@/lib/types/memberships"
import { addMonths, subDays, differenceInCalendarDays, addYears } from "date-fns"
import {
  addDaysYyyyMmDd,
  isValidDateKey,
  zonedTodayYyyyMmDd,
} from "@/lib/utils/timezone"

const membershipCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function daysBetweenDateKeys(a: string, b: string): number {
  const msA = Date.UTC(
    parseInt(a.slice(0, 4)),
    parseInt(a.slice(5, 7)) - 1,
    parseInt(a.slice(8, 10))
  )
  const msB = Date.UTC(
    parseInt(b.slice(0, 4)),
    parseInt(b.slice(5, 7)) - 1,
    parseInt(b.slice(8, 10))
  )
  return Math.round((msA - msB) / 86_400_000)
}

export function calculateMembershipStatus(
  membership: MembershipRecord | null,
  timeZone: string
): MembershipStatus {
  if (!membership) return "none"

  const expiryKey = membership.expiry_date
  if (!expiryKey || !isValidDateKey(expiryKey)) return "expired"

  const todayKey = zonedTodayYyyyMmDd(timeZone)

  if (expiryKey >= todayKey && membership.is_active) {
    return "active"
  }

  const graceDays = membership.grace_period_days ?? 0
  if (graceDays > 0) {
    const graceEndKey = addDaysYyyyMmDd(expiryKey, graceDays)
    if (graceEndKey >= todayKey) {
      return "grace"
    }
  }

  return "expired"
}

export function getDaysUntilExpiry(
  membership: MembershipRecord,
  timeZone: string
): number {
  const expiryKey = membership.expiry_date
  if (!expiryKey || !isValidDateKey(expiryKey)) return 0
  const todayKey = zonedTodayYyyyMmDd(timeZone)
  return Math.max(0, daysBetweenDateKeys(expiryKey, todayKey))
}

export function getGracePeriodRemaining(
  membership: MembershipRecord,
  timeZone: string
): number {
  const expiryKey = membership.expiry_date
  if (!expiryKey || !isValidDateKey(expiryKey)) return 0
  const graceDays = membership.grace_period_days ?? 0
  const graceEndKey = addDaysYyyyMmDd(expiryKey, graceDays)
  const todayKey = zonedTodayYyyyMmDd(timeZone)
  return Math.max(0, daysBetweenDateKeys(graceEndKey, todayKey))
}

export function getStatusBadgeClasses(status: MembershipStatus): string {
  if (status === "active") return "bg-green-100 text-green-700 border-none"
  if (status === "grace") return "bg-amber-100 text-amber-700 border-none"
  if (status === "expired") return "bg-zinc-200 text-zinc-700 border-none"
  return "bg-slate-100 text-slate-700 border-none"
}

export function getStatusText(status: MembershipStatus): string {
  if (status === "active") return "Active"
  if (status === "grace") return "Grace Period"
  if (status === "expired") return "Expired"
  return "No Membership"
}

export function isMembershipExpiringSoon(
  membership: MembershipRecord,
  timeZone: string
): boolean {
  const days = getDaysUntilExpiry(membership, timeZone)
  return days > 0 && days <= 30
}

export const MEMBERSHIP_RENEWAL_WINDOW_DAYS = 30

export function isMembershipExpired(
  membership: MembershipRecord,
  timeZone: string
): boolean {
  const expiryKey = membership.expiry_date
  if (!expiryKey || !isValidDateKey(expiryKey)) return true
  const todayKey = zonedTodayYyyyMmDd(timeZone)
  return expiryKey < todayKey
}

export function isMembershipEligibleForRenewal(
  membership: MembershipRecord,
  timeZone: string,
  windowDays = MEMBERSHIP_RENEWAL_WINDOW_DAYS
): boolean {
  if (isMembershipExpired(membership, timeZone)) return true
  const daysUntilExpiry = getDaysUntilExpiry(membership, timeZone)
  return daysUntilExpiry <= windowDays
}

export function getMembershipCardBorderClass(status: MembershipStatus): string {
  if (status === "active") return "border-l-green-500"
  if (status === "grace") return "border-l-amber-500"
  if (status === "expired") return "border-l-zinc-400"
  return "border-l-slate-300"
}

export function calculateMembershipFee(
  rate: number | null | undefined,
  isTaxable: boolean | null | undefined,
  defaultTaxRate?: number | null,
  taxName?: string | null
): string {
  if (rate == null) return "Not set"
  const normalizedTaxRate = defaultTaxRate ?? 0
  const finalAmount =
    isTaxable && normalizedTaxRate > 0
      ? rate * (1 + normalizedTaxRate)
      : rate
  const currency = membershipCurrencyFormatter.format(finalAmount)

  if (isTaxable && normalizedTaxRate > 0) {
    const label = taxName?.trim() || "tax"
    return `${currency} incl ${label}`
  }

  return currency
}

/**
 * First calendar occurrence of (end_month, end_day) that is on or after `startDate`
 * (e.g. start 6 Apr 2026 with end 31 Mar → 31 Mar 2027, not 31 Mar 2028).
 */
export function firstMembershipYearEndOnOrAfter(
  startDate: Date,
  endMonth: number,
  endDay: number
): Date {
  const y = startDate.getFullYear()
  let candidate = new Date(y, endMonth - 1, endDay)
  if (candidate < startDate) {
    candidate = new Date(y + 1, endMonth - 1, endDay)
  }
  return candidate
}

export function computeMembershipExpiryDefault(
  startDate: Date,
  durationMonths: number,
  membershipYear?: MembershipYearSettings | null
): Date {
  if (!membershipYear?.end_month || !membershipYear?.end_day) {
    return subDays(addMonths(startDate, durationMonths), 1)
  }

  const graceDays = membershipYear.early_join_grace_days ?? 90

  let expiry = firstMembershipYearEndOnOrAfter(
    startDate,
    membershipYear.end_month,
    membershipYear.end_day
  )

  if (graceDays > 0) {
    const daysUntilFirstEnd = differenceInCalendarDays(expiry, startDate)
    if (daysUntilFirstEnd <= graceDays) {
      expiry = addYears(expiry, 1)
    }
  }

  const membershipYearCount = Math.max(1, Math.ceil(durationMonths / 12))
  if (membershipYearCount > 1) {
    expiry = addYears(expiry, membershipYearCount - 1)
  }

  return expiry
}

export function parseMembershipDateKey(value: string | null | undefined): Date | null {
  if (!value || !isValidDateKey(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

/**
 * Parses membership date fields from the API for forms and pickers. Accepts Postgres `date`
 * strings (`yyyy-MM-dd`) and ISO-8601 timestamps (e.g. `start_date` saved via `Date#toISOString()`).
 */
export function parseMembershipDateField(value: string | null | undefined): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  const keyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
  if (keyMatch?.[1] && isValidDateKey(keyMatch[1])) {
    return parseMembershipDateKey(keyMatch[1])
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

export function computeMembershipRenewalExpiry(
  currentExpiryDate: Date,
  durationMonths: number
): Date {
  return addMonths(currentExpiryDate, durationMonths)
}
