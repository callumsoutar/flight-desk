import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { MemberDetailWithRelations } from "@/lib/types/members"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function fetchMemberDetail(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string
): Promise<MemberDetailWithRelations | null> {
  const { data: tenantUser, error: tenantUserError } = await supabase
    .from("tenant_users")
    .select(
      "id, user_id, is_active, granted_at, role:roles!tenant_users_role_id_fkey(id, name), user:users!tenant_users_user_id_fkey(id, first_name, last_name, email, phone, street_address, gender, date_of_birth, notes, next_of_kin_name, next_of_kin_phone, company_name, occupation, employer, pilot_license_number, pilot_license_type, pilot_license_id, pilot_license_expiry, medical_certificate_expiry)"
    )
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()

  if (tenantUserError) throw tenantUserError
  if (!tenantUser) return null

  const [membershipResult, instructorResult, authUserResult] = await Promise.all([
    supabase
      .from("memberships")
      .select(
        "id, is_active, start_date, expiry_date, membership_type:membership_types(id, name)"
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("instructors")
      .select("id, status, is_actively_instructing")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.rpc("is_auth_user", { user_uuid: userId }),
  ])

  if (membershipResult.error) throw membershipResult.error
  if (instructorResult.error) throw instructorResult.error
  if (authUserResult.error) throw authUserResult.error

  const membership = membershipResult.data
    ? {
        id: membershipResult.data.id,
        is_active: membershipResult.data.is_active,
        start_date: membershipResult.data.start_date,
        expiry_date: membershipResult.data.expiry_date,
        membership_type: pickMaybeOne(membershipResult.data.membership_type),
      }
    : null

  return {
    id: tenantUser.id,
    user_id: tenantUser.user_id,
    is_active: tenantUser.is_active,
    granted_at: tenantUser.granted_at,
    role: pickMaybeOne(tenantUser.role),
    user: pickMaybeOne(tenantUser.user),
    membership,
    instructor: instructorResult.data ?? null,
    is_auth_user: Boolean(authUserResult.data),
  }
}
