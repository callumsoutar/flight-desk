import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  buildMemberFlightHistoryDateRangeLabel,
  buildMemberFlightHistoryPdfFilename,
  buildMemberFlightHistorySummaryData,
  filterMemberFlightHistoryEntries,
} from "@/lib/flight-history/member-flight-history-summary"
import { fetchBookings } from "@/lib/bookings/fetch-bookings"
import { resolveTenantLogoSignedUrl } from "@/lib/settings/logo-storage-admin"
import type { Database } from "@/lib/types"
import { formatDate } from "@/lib/utils/date-format"

export type MemberFlightHistorySummaryReport = {
  member: {
    id: string
    firstName: string
    lastName: string
    name: string
    email: string | null
  }
  tenant: {
    name: string
    logoUrl: string | null
    contactEmail: string | null
    timezone: string
  }
  dateRangeLabel: string
  fromDate: string
  toDate: string
  generatedAtLabel: string
  totalFlights: number
  totalFlightHoursLabel: string
  avgHoursPerFlightLabel: string
  rows: ReturnType<typeof buildMemberFlightHistorySummaryData>["rows"]
  pdfFilename: string
}

export async function fetchMemberFlightHistorySummaryReport(
  supabase: SupabaseClient<Database>,
  options: {
    tenantId: string
    memberUserId: string
    fromDate: string
    toDate: string
  }
): Promise<
  { ok: true; data: MemberFlightHistorySummaryReport } | { ok: false; error: "not_found" | "query_failed" }
> {
  const { tenantId, memberUserId, fromDate, toDate } = options

  const [{ data: memberTenant, error: memberError }, { data: tenant, error: tenantError }] =
    await Promise.all([
      supabase
        .from("tenant_users")
        .select("user:user_directory!tenant_users_user_id_fkey(id, first_name, last_name, email)")
        .eq("tenant_id", tenantId)
        .eq("user_id", memberUserId)
        .maybeSingle(),
      supabase
        .from("tenants")
        .select("name, logo_url, contact_email, timezone")
        .eq("id", tenantId)
        .maybeSingle(),
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

  const timeZone = tenant?.timezone?.trim() || "Pacific/Auckland"

  let flights: Awaited<ReturnType<typeof fetchBookings>>
  try {
    flights = await fetchBookings(supabase, tenantId, {
      user_id: memberUserId,
      status: ["complete"],
    })
  } catch {
    return { ok: false, error: "query_failed" }
  }

  flights.sort((a, b) => {
    const aTime = a.end_time ? new Date(a.end_time).getTime() : 0
    const bTime = b.end_time ? new Date(b.end_time).getTime() : 0
    return bTime - aTime
  })

  const filteredFlights = filterMemberFlightHistoryEntries(flights, fromDate, toDate, timeZone)
  const summary = buildMemberFlightHistorySummaryData(filteredFlights, timeZone)

  const firstName = member.first_name?.trim() || ""
  const lastName = member.last_name?.trim() || ""
  const memberName = `${firstName} ${lastName}`.trim() || member.email?.trim() || "Member"
  const tenantName = tenant?.name?.trim() || "Flight Desk"
  const logoUrl = await resolveTenantLogoSignedUrl(tenant?.logo_url ?? null)

  return {
    ok: true,
    data: {
      member: {
        id: member.id,
        firstName: firstName || "there",
        lastName,
        name: memberName,
        email: member.email?.trim() || null,
      },
      tenant: {
        name: tenantName,
        logoUrl,
        contactEmail: tenant?.contact_email?.trim() || null,
        timezone: timeZone,
      },
      dateRangeLabel: buildMemberFlightHistoryDateRangeLabel(fromDate, toDate, timeZone),
      fromDate,
      toDate,
      generatedAtLabel: formatDate(new Date(), timeZone, "long") || "—",
      totalFlights: summary.stats.totalFlights,
      totalFlightHoursLabel: `${summary.stats.totalFlightHours.toFixed(1)}h`,
      avgHoursPerFlightLabel: `${summary.stats.avgHoursPerFlight.toFixed(1)}h`,
      rows: summary.rows,
      pdfFilename: buildMemberFlightHistoryPdfFilename(memberName, fromDate, toDate),
    },
  }
}
