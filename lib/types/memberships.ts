import type { ChargeablesRow, Json, MembershipRow, MembershipTypesRow } from "@/lib/types"

export type MembershipTypeWithChargeable = Pick<
  MembershipTypesRow,
  | "id"
  | "name"
  | "code"
  | "description"
  | "duration_months"
  | "benefits"
  | "is_active"
  | "chargeable_id"
> & {
  benefits: Json | null
  chargeables: Pick<ChargeablesRow, "id" | "name" | "rate" | "is_taxable"> | null
}

export type MembershipRecord = Pick<
  MembershipRow,
  | "id"
  | "is_active"
  | "start_date"
  | "expiry_date"
  | "grace_period_days"
  | "invoice_id"
  | "notes"
  | "membership_type_id"
> & {
  membership_types: MembershipTypeWithChargeable | null
}

export type MembershipStatus =
  | "active"
  | "grace"
  | "expired"
  | "none"

export type MembershipSummary = {
  status: MembershipStatus
  current_membership: MembershipRecord | null
  membership_history: MembershipRecord[]
}

export type TenantDefaultTaxRate = {
  rate: number
  tax_name: string
} | null

export type MembershipYearSettings = {
  end_day: number
  end_month: number
  description?: string
  /** Days from start to first aligned expiry; if within this window, roll expiry one year forward. Omitted means 90 in computeMembershipExpiryDefault. */
  early_join_grace_days?: number
}
