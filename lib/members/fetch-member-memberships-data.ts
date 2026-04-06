import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { isJsonObject } from "@/lib/settings/utils"
import type { Database } from "@/lib/types"
import type {
  MembershipRecord,
  MembershipYearSettings,
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
  membershipYear: MembershipYearSettings | null
}

export async function fetchMemberMembershipsData(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string,
  timeZone: string
): Promise<MemberMembershipsData> {
  const today = new Date().toISOString().slice(0, 10)
  const [membershipsResult, membershipTypesResult, taxResult, tenantSettingsResult] = await Promise.all([
    supabase
      .from("memberships")
      .select(
        "id, is_active, start_date, expiry_date, grace_period_days, invoice_id, notes, membership_type_id, membership_types:membership_types!memberships_membership_type_id_fkey(id, name, code, description, duration_months, benefits, is_active, chargeable_id, chargeables:chargeables!fk_membership_chargeable(id, name, rate, is_taxable)), invoices:invoices!memberships_invoice_id_fkey(id, status)"
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .order("start_date", { ascending: false }),
    supabase
      .from("membership_types")
      .select(
        "id, name, code, description, duration_months, benefits, is_active, chargeable_id, chargeables:chargeables!fk_membership_chargeable(id, name, rate, is_taxable)"
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
    supabase
      .from("tenant_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ])

  if (membershipsResult.error) throw membershipsResult.error
  if (membershipTypesResult.error) throw membershipTypesResult.error
  if (taxResult.error) throw taxResult.error
  if (tenantSettingsResult.error) throw tenantSettingsResult.error

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
    status: calculateMembershipStatus(currentMembership, timeZone),
    current_membership: currentMembership,
    membership_history: membershipHistory,
  }

  const membershipTypes: MembershipTypeWithChargeable[] = (
    membershipTypesResult.data ?? []
  ).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    duration_months: row.duration_months,
    benefits: row.benefits ?? null,
    is_active: row.is_active,
    chargeable_id: row.chargeable_id,
    chargeables: pickMaybeOne(row.chargeables),
  }))

  const defaultTaxRate: TenantDefaultTaxRate = taxResult.data
    ? {
        rate: taxResult.data.rate,
        tax_name: taxResult.data.tax_name,
      }
    : null

  let membershipYear: MembershipYearSettings | null = null
  const rawSettings = tenantSettingsResult.data?.settings
  if (isJsonObject(rawSettings)) {
    const rawMembershipYear = rawSettings.membership_year
    if (isJsonObject(rawMembershipYear)) {
      const endMonth = rawMembershipYear.end_month
      const endDay = rawMembershipYear.end_day
      if (
        typeof endMonth === "number" &&
        Number.isInteger(endMonth) &&
        endMonth >= 1 &&
        endMonth <= 12 &&
        typeof endDay === "number" &&
        Number.isInteger(endDay) &&
        endDay >= 1 &&
        endDay <= 31
      ) {
        const rawGrace = rawMembershipYear.early_join_grace_days
        const early_join_grace_days =
          typeof rawGrace === "number" &&
          Number.isInteger(rawGrace) &&
          rawGrace >= 0 &&
          rawGrace <= 365
            ? rawGrace
            : undefined

        membershipYear = {
          end_month: endMonth,
          end_day: endDay,
          description:
            typeof rawMembershipYear.description === "string"
              ? rawMembershipYear.description
              : undefined,
          ...(early_join_grace_days !== undefined ? { early_join_grace_days } : {}),
        }
      }
    }
  }

  return { summary, membershipTypes, defaultTaxRate, membershipYear }
}
