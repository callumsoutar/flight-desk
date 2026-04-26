import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { fetchMembers } from "@/lib/members/fetch-members"
import type { Database } from "@/lib/types"
import type { MemberWithBalance, MemberBalanceRow } from "@/lib/types/member-balances"
import type { MembersFilter } from "@/lib/types/members"

function mergeByUserId(
  members: Awaited<ReturnType<typeof fetchMembers>>,
  rows: MemberBalanceRow[] | null
): MemberWithBalance[] {
  const byUser = new Map(rows?.map((r) => [r.user_id, r]) ?? [])

  return members.map((m) => {
    const b = byUser.get(m.user_id)
    return {
      ...m,
      current_balance: b?.current_balance ?? 0,
      last_payment_at: b?.last_payment_at ?? null,
    }
  })
}

export async function fetchMemberBalanceMetricsRows(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<{ rows: MemberBalanceRow[]; timeZone: string }> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .maybeSingle()
  const timeZone = tenant?.timezone?.trim() || "Pacific/Auckland"

  const { data, error } = await supabase.rpc("get_member_balance_metrics", {
    p_tenant_id: tenantId,
    p_time_zone: timeZone,
  })

  if (error) throw error
  return { rows: (data ?? []) as MemberBalanceRow[], timeZone }
}

export async function fetchMembersWithBalanceMetrics(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  membersFilters?: MembersFilter
): Promise<{ members: MemberWithBalance[]; timeZone: string }> {
  const [memberList, { rows, timeZone }] = await Promise.all([
    fetchMembers(supabase, tenantId, membersFilters),
    fetchMemberBalanceMetricsRows(supabase, tenantId),
  ])
  return { members: mergeByUserId(memberList, rows), timeZone }
}
