import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type {
  MembershipRecord,
  MembershipSummary,
  TenantDefaultTaxRate,
  MembershipTypeWithChargeable,
} from "@/lib/types/memberships"
import { calculateMembershipStatus } from "@/lib/utils/membership-utils"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export type MemberMembershipsData = {
  summary: MembershipSummary
  membershipTypes: MembershipTypeWithChargeable[]
  defaultTaxRate: TenantDefaultTaxRate
}

export async function fetchMemberMembershipsData(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string
): Promise<MemberMembershipsData> {
  const today = new Date().toISOString().slice(0, 10)
  const [membershipsResult, membershipTypesResult, taxResult] = await Promise.all([
    supabase
      .from("memberships")
      .select(
        "id, is_active, start_date, expiry_date, grace_period_days, invoice_id, notes, membership_type_id, membership_types:membership_types!memberships_membership_type_id_fkey(id, name, duration_months, is_active, chargeables:chargeables!fk_membership_chargeable(id, rate, is_taxable)), invoices:invoices!memberships_invoice_id_fkey(id, status)"
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .order("start_date", { ascending: false }),
    supabase
      .from("membership_types")
      .select(
        "id, name, duration_months, is_active, chargeables:chargeables!fk_membership_chargeable(id, rate, is_taxable)"
      )
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("tax_rates")
      .select("rate, tax_name, effective_from")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .eq("is_default", true)
      .lte("effective_from", today)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (membershipsResult.error) throw membershipsResult.error
  if (membershipTypesResult.error) throw membershipTypesResult.error
  if (taxResult.error) throw taxResult.error

  const membershipHistory: MembershipRecord[] = (membershipsResult.data ?? []).map(
    (row) => ({
      id: row.id,
      is_active: row.is_active,
      start_date: row.start_date,
      expiry_date: row.expiry_date,
      grace_period_days: row.grace_period_days,
      invoice_id: row.invoice_id,
      notes: row.notes,
      membership_type_id: row.membership_type_id,
      membership_types: pickMaybeOne(row.membership_types) as MembershipRecord["membership_types"],
      invoices: pickMaybeOne(row.invoices) as MembershipRecord["invoices"],
    })
  )

  const currentMembership = membershipHistory[0] ?? null
  const summary: MembershipSummary = {
    status: calculateMembershipStatus(currentMembership),
    current_membership: currentMembership,
    membership_history: membershipHistory,
  }

  const membershipTypes: MembershipTypeWithChargeable[] = (
    membershipTypesResult.data ?? []
  ).map((row) => ({
    id: row.id,
    name: row.name,
    duration_months: row.duration_months,
    is_active: row.is_active,
    chargeables: pickMaybeOne(row.chargeables),
  }))

  const defaultTaxRate: TenantDefaultTaxRate = taxResult.data
    ? {
        rate: taxResult.data.rate,
        tax_name: taxResult.data.tax_name,
      }
    : null

  return { summary, membershipTypes, defaultTaxRate }
}
