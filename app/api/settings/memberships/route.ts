import { z } from "zod"

import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchMembershipsSettings } from "@/lib/settings/fetch-memberships-settings"
import {
  DEFAULT_MEMBERSHIP_YEAR,
  resolveMembershipsSettings,
} from "@/lib/settings/memberships-settings"
import { isJsonObject } from "@/lib/settings/utils"
import type { Json } from "@/lib/types"

export const dynamic = "force-dynamic"

const membershipYearSchema = z.strictObject({
  start_month: z.number().int().min(1).max(12),
  start_day: z.number().int().min(1).max(31),
  end_month: z.number().int().min(1).max(12).optional(),
  end_day: z.number().int().min(1).max(31).optional(),
  description: z.string().trim().max(500).optional(),
  early_join_grace_days: z.number().int().min(0).max(365).optional(),
})

const patchSchema = z.strictObject({
  memberships: z.strictObject({
    membership_year: membershipYearSchema,
  }),
})

export async function GET() {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  try {
    const settings = await fetchMembershipsSettings(supabase, tenantId)
    return noStoreJson({ settings })
  } catch {
    return noStoreJson({ error: "Failed to load membership settings" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, user, tenantId } = session.context

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const patch = parsed.data.memberships
  const normalized: Record<string, Json> = {}

  const { data: existingRow, error: existingError } = await supabase
    .from("tenant_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (existingError) {
    return noStoreJson({ error: "Failed to load existing tenant settings" }, { status: 500 })
  }

  const existing = isJsonObject(existingRow?.settings) ? existingRow?.settings : {}
  const existingMembershipYear = isJsonObject(existing.membership_year) ? existing.membership_year : {}

  const mergedMembershipYear: Record<string, Json> = {
    ...existingMembershipYear,
    start_month: patch.membership_year.start_month,
    start_day: patch.membership_year.start_day,
    description: patch.membership_year.description ?? DEFAULT_MEMBERSHIP_YEAR.description,
  }
  if (patch.membership_year.early_join_grace_days !== undefined) {
    mergedMembershipYear.early_join_grace_days = patch.membership_year.early_join_grace_days
  }

  const membershipYearSettings = resolveMembershipsSettings({
    membership_year: mergedMembershipYear,
  } satisfies Record<string, Json>).membership_year

  normalized.membership_year = membershipYearSettings as unknown as Json

  const nextSettings = { ...existing, ...normalized } satisfies Record<string, Json>

  if (existingRow) {
    const { error: updateError } = await supabase
      .from("tenant_settings")
      .update({ settings: nextSettings, updated_by: user.id })
      .eq("tenant_id", tenantId)

    if (updateError) {
      return noStoreJson({ error: "Failed to update tenant settings" }, { status: 500 })
    }
  } else {
    const { error: insertError } = await supabase
      .from("tenant_settings")
      .insert({ tenant_id: tenantId, settings: nextSettings, updated_by: user.id })

    if (insertError) {
      return noStoreJson({ error: "Failed to save tenant settings" }, { status: 500 })
    }
  }

  try {
    const settings = await fetchMembershipsSettings(supabase, tenantId)
    return noStoreJson({ settings })
  } catch {
    return noStoreJson({ error: "Settings saved, but failed to reload membership settings" }, { status: 500 })
  }
}
