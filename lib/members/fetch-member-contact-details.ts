import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export type MemberContactDetails = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  street_address: string | null
}

export async function fetchMemberContactDetails(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string
): Promise<MemberContactDetails | null> {
  const { data, error } = await supabase
    .from("tenant_users")
    .select(
      "user:users!tenant_users_user_id_fkey(id, first_name, last_name, email, phone, street_address)"
    )
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw error
  const user = pickMaybeOne(data?.user)
  if (!user) return null

  return {
    id: user.id,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null,
    street_address: user.street_address ?? null,
  }
}

