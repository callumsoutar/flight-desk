import type { MembershipWithType, PersonType } from "@/lib/types/members"
import { getZonedYyyyMmDdAndHHmm, zonedTodayYyyyMmDd } from "@/lib/utils/timezone"

/**
 * Whether the tenant's membership record counts as "active" for list/detail typing.
 * Kept in sync with members directory behaviour (see fetchMembers).
 */
export function isTenantMembershipActive(
  membership: Pick<MembershipWithType, "is_active" | "expiry_date"> | null,
  timeZone: string
): boolean {
  if (!membership || !membership.is_active) return false
  const expiry = new Date(membership.expiry_date)
  if (Number.isNaN(expiry.getTime())) return false
  const expiryDateKey = getZonedYyyyMmDdAndHHmm(expiry, timeZone).yyyyMmDd
  const todayDateKey = zonedTodayYyyyMmDd(timeZone)
  return expiryDateKey >= todayDateKey
}

export type MemberPersonTypeInput = {
  roleName: string | null
  hasInstructor: boolean
  hasActiveMembership: boolean
}

/**
 * Classifies a person for the members list and member detail — staff, instructor, member, or contact.
 */
export function getMemberPersonType(
  input: MemberPersonTypeInput
): Exclude<PersonType, "all"> {
  if (input.roleName === "owner" || input.roleName === "admin") {
    return "staff"
  }

  if (input.hasInstructor) {
    return "instructor"
  }

  if (input.hasActiveMembership) {
    return "member"
  }

  return "contact"
}

/**
 * Subtitle under the name on the member detail page, aligned with members table type.
 */
export function getMemberDetailHeaderSubtitle(
  personType: Exclude<PersonType, "all">,
  options: { membershipStartDateLabel: string | null }
): string {
  if (personType === "staff") return "Staff"
  if (personType === "instructor") return "Instructor"
  if (personType === "member") {
    if (options.membershipStartDateLabel) {
      return `Member since ${options.membershipStartDateLabel}`
    }
    return "Member"
  }
  return "Contact"
}
