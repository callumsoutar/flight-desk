import { NextResponse } from "next/server"
import { z } from "zod"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { fetchMembershipsSettings } from "@/lib/settings/fetch-memberships-settings"
import {
  DEFAULT_MEMBERSHIP_YEAR,
  resolveMembershipsSettings,
} from "@/lib/settings/memberships-settings"
import { isJsonObject } from "@/lib/settings/utils"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/types"

export const dynamic = "force-dynamic"

const membershipYearSchema = z.strictObject({
  start_month: z.number().int().min(1).max(12),
  start_day: z.number().int().min(1).max(31),
  end_month: z.number().int().min(1).max(12).optional(),
  end_day: z.number().int().min(1).max(31).optional(),
  description: z.string().trim().max(500).optional(),
})

const patchSchema = z.strictObject({
  memberships: z.strictObject({
    membership_year: membershipYearSchema,
  }),
})

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Account not configured" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }
  if (!isAdminRole(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const settings = await fetchMembershipsSettings(supabase, tenantId)
    return NextResponse.json({ settings }, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json(
      { error: "Failed to load membership settings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Account not configured" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }
  if (!isAdminRole(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const patch = parsed.data.memberships
  const normalized: Record<string, Json> = {}

  const membershipYearSettings = resolveMembershipsSettings({
    membership_year: {
      start_month: patch.membership_year.start_month,
      start_day: patch.membership_year.start_day,
      description: patch.membership_year.description ?? DEFAULT_MEMBERSHIP_YEAR.description,
    } satisfies Record<string, Json>,
  } satisfies Record<string, Json>).membership_year

  normalized.membership_year = membershipYearSettings as unknown as Json

  const { data: existingRow, error: existingError } = await supabase
    .from("tenant_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json(
      { error: "Failed to load existing tenant settings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  const existing = isJsonObject(existingRow?.settings) ? existingRow?.settings : {}
  const nextSettings = { ...existing, ...normalized } satisfies Record<string, Json>

  if (existingRow) {
    const { error: updateError } = await supabase
      .from("tenant_settings")
      .update({ settings: nextSettings, updated_by: user.id })
      .eq("tenant_id", tenantId)

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update tenant settings" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }
  } else {
    const { error: insertError } = await supabase
      .from("tenant_settings")
      .insert({ tenant_id: tenantId, settings: nextSettings, updated_by: user.id })

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to save tenant settings" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }
  }

  try {
    const settings = await fetchMembershipsSettings(supabase, tenantId)
    return NextResponse.json({ settings }, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json(
      { error: "Settings saved, but failed to reload membership settings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

