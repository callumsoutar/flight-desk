import { NextResponse } from "next/server"
import { z } from "zod"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { fetchBookingsSettings } from "@/lib/settings/fetch-bookings-settings"
import { DEFAULT_BOOKINGS_SETTINGS } from "@/lib/settings/bookings-settings"
import { isJsonObject, normalizeNonNegativeInt } from "@/lib/settings/utils"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/types"

export const dynamic = "force-dynamic"

function clampNonNegativeHours(value: number, fallback: number, maxHours = 24) {
  if (!Number.isFinite(value)) return fallback
  if (value < 0) return fallback
  const clamped = Math.min(maxHours, value)
  return Math.round(clamped * 4) / 4
}

const bookingsPatchSchema = z.object({
  default_booking_duration_hours: z.number().min(0).max(24).optional(),
  minimum_booking_duration_minutes: z.number().int().min(0).max(1440).optional(),
  default_booking_briefing_charge_enabled: z.boolean().optional(),
  default_booking_briefing_chargeable_id: z.string().uuid().nullable().optional(),
})

const patchSchema = z.object({
  bookings: bookingsPatchSchema,
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
    const settings = await fetchBookingsSettings(supabase, tenantId)
    return NextResponse.json({ settings }, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json(
      { error: "Failed to load booking settings" },
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

  const patch = parsed.data.bookings
  const normalized: Record<string, Json> = {}

  if (patch.default_booking_duration_hours !== undefined) {
    normalized.default_booking_duration_hours = clampNonNegativeHours(
      patch.default_booking_duration_hours,
      DEFAULT_BOOKINGS_SETTINGS.default_booking_duration_hours
    )
  }

  if (patch.minimum_booking_duration_minutes !== undefined) {
    normalized.minimum_booking_duration_minutes = normalizeNonNegativeInt(
      patch.minimum_booking_duration_minutes,
      DEFAULT_BOOKINGS_SETTINGS.minimum_booking_duration_minutes,
      1440
    )
  }

  if (patch.default_booking_briefing_charge_enabled !== undefined) {
    normalized.default_booking_briefing_charge_enabled = patch.default_booking_briefing_charge_enabled
  }

  if (patch.default_booking_briefing_chargeable_id !== undefined) {
    normalized.default_booking_briefing_chargeable_id = patch.default_booking_briefing_chargeable_id
  }

  if (Object.keys(normalized).length === 0) {
    return NextResponse.json(
      { error: "No updates provided" },
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
    const settings = await fetchBookingsSettings(supabase, tenantId)
    return NextResponse.json({ settings }, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json(
      { error: "Settings saved, but failed to reload booking settings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
