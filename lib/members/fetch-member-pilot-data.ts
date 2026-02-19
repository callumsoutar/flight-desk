import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { EndorsementLite, LicenseLite, UserEndorsementWithRelation } from "@/lib/types/members"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export type MemberPilotData = {
  availableLicenses: LicenseLite[]
  availableEndorsements: EndorsementLite[]
  userEndorsements: UserEndorsementWithRelation[]
}

async function fetchAvailableLicenses(
  supabase: SupabaseClient<Database>
): Promise<LicenseLite[]> {
  const sessionResult = await supabase
    .from("licenses")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (sessionResult.error) throw sessionResult.error

  return (sessionResult.data ?? []) as LicenseLite[]
}

export async function fetchMemberPilotData(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string
): Promise<MemberPilotData> {
  const [availableLicenses, endorsementsResult, userEndorsementsResult] = await Promise.all([
    fetchAvailableLicenses(supabase),
    supabase
      .from("endorsements")
      .select("id, name, is_active, voided_at")
      .eq("is_active", true)
      .is("voided_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("users_endorsements")
      .select(
        "id, issued_date, expiry_date, notes, voided_at, endorsement:endorsements!users_endorsements_endorsement_id_fkey(id, name, is_active, voided_at)"
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .is("voided_at", null)
      .order("issued_date", { ascending: false }),
  ])

  if (endorsementsResult.error) throw endorsementsResult.error
  if (userEndorsementsResult.error) throw userEndorsementsResult.error

  const userEndorsements: UserEndorsementWithRelation[] = (userEndorsementsResult.data ?? []).map((row) => ({
    id: row.id,
    issued_date: row.issued_date,
    expiry_date: row.expiry_date,
    notes: row.notes,
    voided_at: row.voided_at,
    endorsement: pickMaybeOne(row.endorsement),
  }))

  return {
    availableLicenses,
    availableEndorsements: (endorsementsResult.data ?? []) as EndorsementLite[],
    userEndorsements,
  }
}
