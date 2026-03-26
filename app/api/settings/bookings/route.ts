import { z } from "zod"

import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchBookingsSettings } from "@/lib/settings/fetch-bookings-settings"
import { DEFAULT_BOOKINGS_SETTINGS } from "@/lib/settings/bookings-settings"
import { isJsonObject, normalizeNonNegativeInt } from "@/lib/settings/utils"
import type { Json } from "@/lib/types"

export const dynamic = "force-dynamic"

function clampNonNegativeHours(value: number, fallback: number, maxHours = 24) {
  if (!Number.isFinite(value)) return fallback
  if (value < 0) return fallback
  const clamped = Math.min(maxHours, value)
  return Math.round(clamped * 4) / 4
}

const bookingsPatchSchema = z.strictObject({
  default_booking_duration_hours: z.number().min(0).max(24).optional(),
  minimum_booking_duration_minutes: z.number().int().min(0).max(1440).optional(),
  default_booking_briefing_charge_enabled: z.boolean().optional(),
  default_booking_briefing_chargeable_id: z.string().uuid().nullable().optional(),
})

const patchSchema = z.strictObject({
  bookings: bookingsPatchSchema,
})

export async function GET() {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  try {
    const settings = await fetchBookingsSettings(supabase, tenantId)
    return noStoreJson({ settings })
  } catch {
    return noStoreJson({ error: "Failed to load booking settings" }, { status: 500 })
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
    return noStoreJson({ error: "No updates provided" }, { status: 400 })
  }

  const { data: existingRow, error: existingError } = await supabase
    .from("tenant_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (existingError) {
    return noStoreJson({ error: "Failed to load existing tenant settings" }, { status: 500 })
  }

  const existing = isJsonObject(existingRow?.settings) ? existingRow?.settings : {}
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
    const settings = await fetchBookingsSettings(supabase, tenantId)
    return noStoreJson({ settings })
  } catch {
    return noStoreJson({ error: "Settings saved, but failed to reload booking settings" }, { status: 500 })
  }
}
