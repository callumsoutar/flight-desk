import type {
  MembershipRecord,
  MembershipStatus,
} from "@/lib/types/memberships"

function asDate(value: string) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function calculateMembershipStatus(
  membership: MembershipRecord | null
): MembershipStatus {
  if (!membership) return "none"

  const invoiceStatus = membership.invoices?.status
  if (invoiceStatus && invoiceStatus !== "paid") {
    return "unpaid"
  }

  const expiry = asDate(membership.expiry_date)
  if (!expiry) return "expired"

  const today = startOfDay(new Date())
  const expiryDay = startOfDay(expiry)

  if (expiryDay >= today && membership.is_active) {
    return "active"
  }

  const graceDays = membership.grace_period_days ?? 0
  const graceEnd = new Date(expiryDay)
  graceEnd.setDate(graceEnd.getDate() + graceDays)

  if (graceDays > 0 && graceEnd >= today) {
    return "grace"
  }

  return "expired"
}

export function getDaysUntilExpiry(membership: MembershipRecord): number {
  const expiry = asDate(membership.expiry_date)
  if (!expiry) return 0
  const today = startOfDay(new Date())
  const expiryDay = startOfDay(expiry)
  const diffMs = expiryDay.getTime() - today.getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

export function getGracePeriodRemaining(membership: MembershipRecord): number {
  const expiry = asDate(membership.expiry_date)
  if (!expiry) return 0
  const today = startOfDay(new Date())
  const graceEnd = startOfDay(expiry)
  graceEnd.setDate(graceEnd.getDate() + (membership.grace_period_days ?? 0))
  const diffMs = graceEnd.getTime() - today.getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
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

export function isMembershipExpiringSoon(membership: MembershipRecord): boolean {
  const days = getDaysUntilExpiry(membership)
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
