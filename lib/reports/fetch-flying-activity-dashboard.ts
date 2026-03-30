import "server-only"

import type { FlyingActivityDashboard } from "@/lib/types/reports"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"

import { callSupabaseRpc } from "@/lib/reports/call-supabase-rpc"

function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

export async function getFlyingActivityDashboard(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<FlyingActivityDashboard | null> {
  try {
    const { data, error } = await callSupabaseRpc(supabase, "get_flying_activity_dashboard", {
      p_tenant_id: tenantId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    })

    // Do not fail the whole reports page: RPC may be missing, RLS may deny, etc.
    if (error || data == null) return null

    const raw = data as unknown as FlyingActivityDashboard
    return {
      ...raw,
      hours_by_month: ensureArray(raw.hours_by_month),
      hours_by_flight_type: ensureArray(raw.hours_by_flight_type),
      hours_by_stage: ensureArray(raw.hours_by_stage),
      flying_days_per_month: ensureArray(raw.flying_days_per_month),
      cancellations_by_category: raw.cancellations_by_category ?? [],
    }
  } catch {
    return null
  }
}
