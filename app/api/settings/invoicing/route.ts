import { NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { fetchInvoicingSettings } from "@/lib/settings/fetch-invoicing-settings"
import { DEFAULT_INVOICING_SETTINGS } from "@/lib/settings/invoicing-settings"
import {
  isJsonObject,
  normalizeNonNegativeInt,
  normalizeNullableString as normalizeOptionalString,
} from "@/lib/settings/utils"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/types"

export const dynamic = "force-dynamic"

function isSettingsAdmin(role: string | null) {
  return role === "owner" || role === "admin"
}

const invoicingPatchSchema = z.object({
  invoice_prefix: z.string().trim().min(1).max(24).optional(),
  invoice_number_mode: z.enum(["internal", "xero"]).optional(),
  default_invoice_due_days: z.number().int().min(0).max(3650).optional(),
  invoice_footer_message: z.string().trim().max(2000).nullable().optional(),
  include_logo_on_invoice: z.boolean().optional(),
})

const patchSchema = z.object({
  invoicing: invoicingPatchSchema,
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

  if (!isSettingsAdmin(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const settings = await fetchInvoicingSettings(supabase, tenantId)
    return NextResponse.json(
      { settings },
      { headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to load invoicing settings" },
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

  if (!isSettingsAdmin(role)) {
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

  const patch = parsed.data.invoicing

  const normalized: Record<string, Json> = {}

  if (patch.invoice_prefix !== undefined) normalized.invoice_prefix = patch.invoice_prefix.trim()
  if (patch.invoice_number_mode !== undefined) normalized.invoice_number_mode = patch.invoice_number_mode
  if (patch.default_invoice_due_days !== undefined) {
    normalized.default_invoice_due_days = normalizeNonNegativeInt(
      patch.default_invoice_due_days,
      DEFAULT_INVOICING_SETTINGS.default_invoice_due_days,
      3650
    )
  }
  if (patch.invoice_footer_message !== undefined) {
    normalized.invoice_footer_message = normalizeOptionalString(patch.invoice_footer_message) ?? null
  }
  if (patch.include_logo_on_invoice !== undefined) normalized.include_logo_on_invoice = patch.include_logo_on_invoice

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
    const settings = await fetchInvoicingSettings(supabase, tenantId)
    return NextResponse.json(
      { settings },
      { headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Settings saved, but failed to reload invoicing settings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
