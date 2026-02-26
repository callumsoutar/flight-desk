import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type {
  InvoiceCreateChargeable,
  InvoiceCreateMember,
} from "@/lib/types/invoice-create"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export type InvoiceCreateData = {
  members: InvoiceCreateMember[]
  chargeables: InvoiceCreateChargeable[]
  defaultTaxRate: number
}

export async function fetchInvoiceCreateData(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<InvoiceCreateData> {
  const [membersResult, chargeablesResult, taxRatesResult] = await Promise.all([
    supabase
      .from("tenant_users")
      .select("user:user_directory!tenant_users_user_id_fkey(id, first_name, last_name, email)")
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase
      .from("chargeables")
      .select("id, name, description, rate, is_taxable, chargeable_type_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .is("voided_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("tax_rates")
      .select("rate, is_default, effective_from")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("effective_from", { ascending: false }),
  ])

  if (membersResult.error) throw membersResult.error
  if (chargeablesResult.error) throw chargeablesResult.error
  if (taxRatesResult.error) throw taxRatesResult.error

  const members = (membersResult.data ?? [])
    .map((row) => pickMaybeOne(row.user))
    .filter((row): row is InvoiceCreateMember => Boolean(row?.id && row.email))
    .sort((a, b) => {
      const left = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || a.email
      const right = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim() || b.email
      return left.localeCompare(right)
    })

  const rawTaxRate = taxRatesResult.data?.[0]?.rate
  const defaultTaxRate =
    typeof rawTaxRate === "number" && rawTaxRate >= 0 && rawTaxRate <= 1 ? rawTaxRate : 0

  return {
    members,
    chargeables: (chargeablesResult.data ?? []) as InvoiceCreateChargeable[],
    defaultTaxRate,
  }
}
