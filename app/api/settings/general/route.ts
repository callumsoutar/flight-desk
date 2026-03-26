import { NextResponse } from "next/server"
import { z } from "zod"

import { getRequiredApiSession } from "@/lib/auth/api-session"
import { isAdminRole } from "@/lib/auth/roles"
import { fetchGeneralSettings } from "@/lib/settings/fetch-general-settings"
import { businessHoursToTenantSettingsPatch } from "@/lib/settings/general-settings"
import { isJsonObject, normalizeNullableString } from "@/lib/settings/utils"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/types"

export const dynamic = "force-dynamic"

function normalizeTimeHHmm(value: string) {
  const [hh, mm] = value.trim().split(":")
  const hour = Number(hh)
  const minute = Number(mm)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

const tenantPatchSchema = z.strictObject({
  name: z.string().trim().min(1).max(140).optional(),
  registration_number: z.string().trim().max(60).nullable().optional(),
  description: z.string().trim().max(1200).nullable().optional(),
  website_url: z.string().trim().max(300).nullable().optional(),
  contact_email: z.string().trim().email().nullable().optional(),
  contact_phone: z.string().trim().max(60).nullable().optional(),
  address: z.string().trim().max(800).nullable().optional(),
  billing_address: z.string().trim().max(800).nullable().optional(),
  gst_number: z.string().trim().max(80).nullable().optional(),
  timezone: z.string().trim().max(80).nullable().optional(),
  currency: z.string().trim().max(10).nullable().optional(),
})

const businessHoursSchema = z.strictObject({
  openTime: z.string().trim().min(1),
  closeTime: z.string().trim().min(1),
  is24Hours: z.boolean(),
  isClosed: z.boolean(),
})

const patchSchema = z.strictObject({
  tenant: tenantPatchSchema.optional(),
  businessHours: businessHoursSchema.optional(),
})

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getRequiredApiSession(supabase, { includeRole: true })

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
    const settings = await fetchGeneralSettings(supabase, tenantId)
    return NextResponse.json(
      { settings },
      { headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to load general settings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getRequiredApiSession(supabase, { includeRole: true })

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

  const tenantPatch = parsed.data.tenant ?? null
  const businessHours = parsed.data.businessHours ?? null

  if (!tenantPatch && !businessHours) {
    return NextResponse.json(
      { error: "No updates provided" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const normalizedBusinessHours =
    businessHours
      ? {
          openTime: normalizeTimeHHmm(businessHours.openTime),
          closeTime: normalizeTimeHHmm(businessHours.closeTime),
          is24Hours: businessHours.is24Hours,
          isClosed: businessHours.isClosed,
        }
      : null

  if (normalizedBusinessHours) {
    const openTime = normalizedBusinessHours.openTime
    const closeTime = normalizedBusinessHours.closeTime
    if (!openTime || !closeTime) {
      return NextResponse.json(
        { error: "Invalid business hours time format" },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }
  }

  if (tenantPatch) {
    const normalized: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(tenantPatch)) {
      if (key === "name") {
        normalized.name = value
        continue
      }
      if (value === undefined) continue
      normalized[key] = normalizeNullableString(value as string | null) ?? null
    }

    const { error: tenantError } = await supabase
      .from("tenants")
      .update(normalized)
      .eq("id", tenantId)

    if (tenantError) {
      return NextResponse.json(
        { error: "Failed to update tenant profile" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }
  }

  if (normalizedBusinessHours) {
    const openTime = normalizedBusinessHours.openTime
    const closeTime = normalizedBusinessHours.closeTime
    if (!openTime || !closeTime) {
      return NextResponse.json(
        { error: "Invalid business hours time format" },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

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

    const existingSettings = isJsonObject(existingRow?.settings) ? existingRow?.settings : {}
    const nextSettings = {
      ...existingSettings,
      ...businessHoursToTenantSettingsPatch({
        openTime,
        closeTime,
        is24Hours: normalizedBusinessHours.is24Hours,
        isClosed: normalizedBusinessHours.isClosed,
      }),
    } satisfies Record<string, Json>

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
          { error: "Failed to create tenant settings" },
          { status: 500, headers: { "cache-control": "no-store" } }
        )
      }
    }
  }

  try {
    const settings = await fetchGeneralSettings(supabase, tenantId)
    return NextResponse.json(
      { settings },
      { headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { ok: true },
      { headers: { "cache-control": "no-store" } }
    )
  }
}
