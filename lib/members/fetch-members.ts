import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type {
  MemberWithRelations,
  MembershipStatus,
  MembershipWithType,
  MembersFilter,
  PersonType,
} from "@/lib/types/members"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function isMembershipActive(membership: MembershipWithType | null) {
  if (!membership || !membership.is_active) return false
  return new Date(membership.expiry_date) >= new Date()
}

function toMembershipStatus(membership: MembershipWithType | null): MembershipStatus {
  if (!membership) return "none"
  return isMembershipActive(membership) ? "active" : "expired"
}

function toPersonType(member: {
  roleName: string | null
  hasInstructor: boolean
  hasActiveMembership: boolean
}): Exclude<PersonType, "all"> {
  if (member.roleName === "owner" || member.roleName === "admin") {
    return "staff"
  }

  if (member.hasInstructor) {
    return "instructor"
  }

  if (member.hasActiveMembership) {
    return "member"
  }

  return "contact"
}

export async function fetchMembers(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  filters?: MembersFilter
): Promise<MemberWithRelations[]> {
  let tenantUsersQuery = supabase
    .from("tenant_users")
    .select(
      "id, user_id, is_active, granted_at, role:roles!tenant_users_role_id_fkey(id, name), user:user_directory!tenant_users_user_id_fkey(id, first_name, last_name, email)"
    )
    .eq("tenant_id", tenantId)
    .order("granted_at", { ascending: false })

  if (typeof filters?.is_active === "boolean") {
    tenantUsersQuery = tenantUsersQuery.eq("is_active", filters.is_active)
  }

  const { data: tenantUsers, error: tenantUsersError } = await tenantUsersQuery
  if (tenantUsersError) throw tenantUsersError

  const rows = tenantUsers ?? []
  const userIds = rows
    .map((row) => row.user_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)

  if (userIds.length === 0) return []

  let membershipsQuery = supabase
    .from("memberships")
    .select(
      "id, user_id, is_active, expiry_date, membership_type:membership_types(id, name)"
    )
    .eq("tenant_id", tenantId)
    .in("user_id", userIds)
    .order("expiry_date", { ascending: false })

  if (filters?.membership_type_id) {
    membershipsQuery = membershipsQuery.eq("membership_type_id", filters.membership_type_id)
  }

  const [membershipsResult, instructorsResult] = await Promise.all([
    membershipsQuery,
    supabase
      .from("instructors")
      .select("id, user_id, status, is_actively_instructing")
      .eq("tenant_id", tenantId)
      .in("user_id", userIds),
  ])

  if (membershipsResult.error) throw membershipsResult.error
  if (instructorsResult.error) throw instructorsResult.error

  const membershipByUser = new Map<string, MembershipWithType>()
  for (const row of membershipsResult.data ?? []) {
    if (!row.user_id || membershipByUser.has(row.user_id)) continue
    membershipByUser.set(row.user_id, {
      id: row.id,
      is_active: row.is_active,
      expiry_date: row.expiry_date,
      membership_type: pickMaybeOne(row.membership_type),
    })
  }

  const instructorByUser = new Map(
    (instructorsResult.data ?? []).map((row) => [row.user_id, row])
  )

  const normalized = rows.map<MemberWithRelations>((row) => {
    const membership = membershipByUser.get(row.user_id) ?? null
    const instructor = instructorByUser.get(row.user_id) ?? null
    const role = pickMaybeOne(row.role)
    const roleName = role?.name ?? null
    const hasActiveMembership = isMembershipActive(membership)

    return {
      id: row.id,
      user_id: row.user_id,
      is_active: row.is_active,
      granted_at: row.granted_at,
      role,
      user: pickMaybeOne(row.user),
      membership,
      instructor,
      membership_status: toMembershipStatus(membership),
      person_type: toPersonType({
        roleName,
        hasInstructor: Boolean(instructor),
        hasActiveMembership,
      }),
    }
  })

  const search = filters?.search?.trim().toLowerCase()

  return normalized.filter((member) => {
    if (filters?.person_type && member.person_type !== filters.person_type) {
      return false
    }

    if (filters?.membership_status && member.membership_status !== filters.membership_status) {
      return false
    }

    if (!search) return true

    const fullName = `${member.user?.first_name ?? ""} ${member.user?.last_name ?? ""}`
      .trim()
      .toLowerCase()

    return (
      fullName.includes(search) ||
      (member.user?.email ?? "").toLowerCase().includes(search) ||
      (member.role?.name ?? "").toLowerCase().includes(search)
    )
  })
}
