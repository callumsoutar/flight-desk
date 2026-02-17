import type { ChargeablesRow, InvoiceRow, MembershipRow, MembershipTypesRow } from "@/lib/types"

export type MembershipTypeWithChargeable = Pick<
  MembershipTypesRow,
  "id" | "name" | "duration_months" | "is_active"
> & {
  chargeables: Pick<ChargeablesRow, "id" | "rate" | "is_taxable"> | null
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
  invoices: Pick<InvoiceRow, "id" | "status"> | null
}

export type MembershipStatus =
  | "active"
  | "grace"
  | "expired"
  | "unpaid"
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
