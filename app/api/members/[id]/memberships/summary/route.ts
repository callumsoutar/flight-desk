import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { isStaffRole } from "@/lib/auth/roles"
import { fetchMemberMembershipsData } from "@/lib/members/fetch-member-memberships-data"

export const dynamic = "force-dynamic"

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getTenantScopedRouteContext({ includeRole: true })
  if (session.response) return session.response
  const { supabase, user, role, tenantId } = session.context

  const { id } = await context.params
  if (!isStaffRole(role) && user.id !== id) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 })
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .maybeSingle()
  const timeZone = tenant?.timezone ?? "Pacific/Auckland"

  try {
    const data = await fetchMemberMembershipsData(supabase, tenantId, id, timeZone)
    return noStoreJson({
      summary: data.summary,
      membership_types: data.membershipTypes,
      default_tax_rate: data.defaultTaxRate,
      membership_year: data.membershipYear,
    })
  } catch {
    return noStoreJson({ error: "Failed to load member memberships" }, { status: 500 })
  }
}
