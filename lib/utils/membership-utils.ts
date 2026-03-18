import type {
  MembershipYearSettings,
  MembershipRecord,
  MembershipStatus,
} from "@/lib/types/memberships"
import { addMonths, subDays } from "date-fns"
import {
  addDaysYyyyMmDd,
  isValidDateKey,
  zonedTodayYyyyMmDd,
} from "@/lib/utils/timezone"

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

  const invoiceStatus = membership.invoices?.status
  if (invoiceStatus && invoiceStatus !== "paid") {
    return "unpaid"
  }

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
  if (status === "unpaid") return "bg-red-100 text-red-700 border-none"
  if (status === "expired") return "bg-zinc-200 text-zinc-700 border-none"
  return "bg-slate-100 text-slate-700 border-none"
}

export function getStatusText(status: MembershipStatus): string {
  if (status === "active") return "Active"
  if (status === "grace") return "Grace Period"
  if (status === "unpaid") return "Unpaid"
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

export function getMembershipCardBorderClass(status: MembershipStatus): string {
  if (status === "active") return "border-l-green-500"
  if (status === "grace") return "border-l-amber-500"
  if (status === "unpaid") return "border-l-red-500"
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
  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(finalAmount)

  if (isTaxable && normalizedTaxRate > 0) {
    const label = taxName?.trim() || "tax"
    return `${currency} incl ${label}`
  }

  return currency
}

export function computeMembershipExpiryDefault(
  startDate: Date,
  durationMonths: number,
  membershipYear?: MembershipYearSettings | null
): Date {
  if (!membershipYear?.end_month || !membershipYear?.end_day) {
    return subDays(addMonths(startDate, durationMonths), 1)
  }

  const earliestExpiry = addMonths(startDate, durationMonths)
  let candidate = new Date(
    earliestExpiry.getFullYear(),
    membershipYear.end_month - 1,
    membershipYear.end_day
  )

  if (candidate < earliestExpiry) {
    candidate = new Date(
      earliestExpiry.getFullYear() + 1,
      membershipYear.end_month - 1,
      membershipYear.end_day
    )
  }

  return candidate
}
