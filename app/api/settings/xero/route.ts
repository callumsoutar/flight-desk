import { NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { fetchXeroSettings } from "@/lib/settings/fetch-xero-settings"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/types"

export const dynamic = "force-dynamic"

function isAdmin(role: string | null) {
  return role === "owner" || role === "admin"
}

function isJsonObject(value: Json | null | undefined): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const patchSchema = z.object({
  xero: z.object({
    default_revenue_account_code: z.string().trim().max(20).nullable().optional(),
    default_tax_type: z.string().trim().max(40).nullable().optional(),
    auto_export_on_approve: z.boolean().optional(),
  }),
})

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    includeTenant: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  if (!isAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const settings = await fetchXeroSettings(supabase, tenantId)
    return NextResponse.json({ settings }, { headers: { "cache-control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Failed to load Xero settings" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    includeTenant: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  if (!isAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const { data: row, error: readError } = await supabase
    .from("tenant_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (readError) return NextResponse.json({ error: "Failed to load existing settings" }, { status: 500 })

  const existing = isJsonObject(row?.settings) ? row.settings : {}
  const existingXero = isJsonObject(existing.xero) ? existing.xero : {}

  const patch = parsed.data.xero
  const nextXero: Record<string, Json> = {
    ...existingXero,
  }

  if (patch.default_revenue_account_code !== undefined) {
    nextXero.default_revenue_account_code = patch.default_revenue_account_code || null
  }
  if (patch.default_tax_type !== undefined) {
    nextXero.default_tax_type = patch.default_tax_type || null
  }
  if (patch.auto_export_on_approve !== undefined) {
    nextXero.auto_export_on_approve = patch.auto_export_on_approve
  }

  const nextSettings = {
    ...existing,
    xero: nextXero,
  }

  if (row) {
    const { error: updateError } = await supabase
      .from("tenant_settings")
      .update({ settings: nextSettings, updated_by: user.id })
      .eq("tenant_id", tenantId)
    if (updateError) return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  } else {
    const { error: insertError } = await supabase.from("tenant_settings").insert({
      tenant_id: tenantId,
      settings: nextSettings,
      updated_by: user.id,
    })
    if (insertError) return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }

  const settings = await fetchXeroSettings(supabase, tenantId)
  return NextResponse.json({ settings }, { headers: { "cache-control": "no-store" } })
}
