import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { buildAccountStatement } from "@/lib/account-statement/build-account-statement"
import {
  buildMemberAccountStatementClosingBalanceTone,
  buildMemberAccountStatementClosingLabel,
  buildMemberAccountStatementDateRangeLabel,
  buildMemberAccountStatementPdfFilename,
  buildMemberAccountStatementPdfRows,
  type MemberAccountStatementPdfRow,
} from "@/lib/account-statement/member-account-statement-pdf-data"
import { resolveTenantLogoSignedUrl } from "@/lib/settings/logo-storage-admin"
import type { Database } from "@/lib/types"
import { formatDate } from "@/lib/utils/date-format"

export type MemberAccountStatementReport = {
  member: {
    name: string
    email: string | null
  }
  tenant: {
    name: string
    logoUrl: string | null
    currency: string
    timezone: string
  }
  dateRangeLabel: string
  fromDate: string
  toDate: string
  generatedAtLabel: string
  rows: MemberAccountStatementPdfRow[]
  closingBalance: number
  closingBalanceLabel: string
  closingBalanceTone: ReturnType<typeof buildMemberAccountStatementClosingBalanceTone>
  pdfFilename: string
}

export async function fetchMemberAccountStatementReport(
  supabase: SupabaseClient<Database>,
  options: {
    tenantId: string
    memberUserId: string
    fromDate: string
    toDate: string
  }
): Promise<
  { ok: true; data: MemberAccountStatementReport } | { ok: false; error: "not_found" | "query_failed" }
> {
  const { tenantId, memberUserId, fromDate, toDate } = options

  const [{ data: memberTenant, error: memberError }, { data: tenant, error: tenantError }, statementResult] =
    await Promise.all([
      supabase
        .from("tenant_users")
        .select("user:user_directory!tenant_users_user_id_fkey(id, first_name, last_name, email)")
        .eq("tenant_id", tenantId)
        .eq("user_id", memberUserId)
        .maybeSingle(),
      supabase.from("tenants").select("name, logo_url, currency, timezone").eq("id", tenantId).maybeSingle(),
      buildAccountStatement(supabase, {
        tenantId,
        targetUserId: memberUserId,
        startDate: fromDate,
        endDate: toDate,
      }),
    ])

  if (memberError || tenantError) {
    return { ok: false, error: "query_failed" }
  }

  const member =
    (memberTenant?.user as
      | { id?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null }
      | null) ?? null

  if (!member?.id) {
    return { ok: false, error: "not_found" }
  }

  if (!statementResult.ok) {
    if (statementResult.error === "not_found") {
      return { ok: false, error: "not_found" }
    }
    return { ok: false, error: "query_failed" }
  }

  const firstName = member.first_name?.trim() || ""
  const lastName = member.last_name?.trim() || ""
  const memberName = `${firstName} ${lastName}`.trim() || member.email?.trim() || "Member"
  const tenantName = tenant?.name?.trim() || "Flight Desk"
  const timeZone = tenant?.timezone?.trim() || "Pacific/Auckland"
  const currency = tenant?.currency?.trim() || "NZD"
  const logoUrl = await resolveTenantLogoSignedUrl(tenant?.logo_url ?? null)

  const { statement, closing_balance: closingBalance } = statementResult.data

  const rows = buildMemberAccountStatementPdfRows(statement, { currency, timeZone })

  return {
    ok: true,
    data: {
      member: {
        name: memberName,
        email: member.email?.trim() || null,
      },
      tenant: {
        name: tenantName,
        logoUrl,
        currency,
        timezone: timeZone,
      },
      dateRangeLabel: buildMemberAccountStatementDateRangeLabel(fromDate, toDate, timeZone),
      fromDate,
      toDate,
      generatedAtLabel: formatDate(new Date(), timeZone, "long") || "—",
      rows,
      closingBalance,
      closingBalanceLabel: buildMemberAccountStatementClosingLabel(closingBalance, currency),
      closingBalanceTone: buildMemberAccountStatementClosingBalanceTone(closingBalance),
      pdfFilename: buildMemberAccountStatementPdfFilename(memberName, fromDate, toDate),
    },
  }
}
