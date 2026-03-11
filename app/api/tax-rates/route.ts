import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isSettingsAdmin(role: string | null) {
  return role === "owner" || role === "admin"
}

const patchSchema = z.object({
  id: z.string().uuid(),
  is_default: z.literal(true),
})

const postSchema = z.object({
  tax_name: z.string().min(1).max(64),
  rate_percent: z.coerce.number().min(0).max(100),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().max(200).optional(),
  region_code: z.string().max(20).optional(),
  make_default: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase, {
    requireUser: true,
  })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  }

  const isDefaultFilter = request.nextUrl.searchParams.get("is_default")
  const isDefault =
    isDefaultFilter === "true" ? true : isDefaultFilter === "false" ? false : undefined

  let query = supabase
    .from("tax_rates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("effective_from", { ascending: false })

  if (isDefault !== undefined) {
    query = query.eq("is_default", isDefault)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: "Failed to fetch tax rates" }, { status: 500 })
  }

  return NextResponse.json({ tax_rates: data ?? [] }, { headers: { "cache-control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    authoritativeRole: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSettingsAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })

  const body = await request.json().catch(() => null)
  if (body && typeof body.rate_percent === "string" && body.rate_percent.trim() === "") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const taxName = parsed.data.tax_name.trim()
  if (!taxName) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)
  const effectiveFrom = parsed.data.effective_from ?? today

  const { data: created, error: insertError } = await supabase
    .from("tax_rates")
    .insert({
      tenant_id: tenantId,
      tax_name: taxName,
      rate: parsed.data.rate_percent / 100,
      country_code: "NZ",
      region_code: parsed.data.region_code ? parsed.data.region_code.trim() : null,
      description: parsed.data.description ? parsed.data.description.trim() : null,
      effective_from: effectiveFrom,
      is_active: true,
      is_default: false,
    })
    .select("id")
    .single()

  if (insertError || !created?.id) {
    return NextResponse.json({ error: "Failed to create tax rate" }, { status: 500 })
  }

  if (parsed.data.make_default) {
    const { data: rpcResult, error: rpcError } = await supabase.rpc("set_default_tax_rate", {
      p_tax_rate_id: created.id,
      p_tenant_id: tenantId,
    })

    if (rpcError) {
      return NextResponse.json({ error: "Failed to set default tax rate" }, { status: 500 })
    }

    const result = rpcResult as { success: boolean; error?: string } | null
    if (!result?.success) {
      return NextResponse.json({ error: result?.error ?? "Failed to set default tax rate" }, { status: 400 })
    }
  }

  const { data: updated, error: fetchError } = await supabase
    .from("tax_rates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("effective_from", { ascending: false })

  if (fetchError) {
    return NextResponse.json({ error: "Failed to fetch tax rates" }, { status: 500 })
  }

  return NextResponse.json({ tax_rates: updated ?? [] }, { headers: { "cache-control": "no-store" } })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    authoritativeRole: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSettingsAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const { id } = parsed.data

  const { data: rpcResult, error: rpcError } = await supabase.rpc("set_default_tax_rate", {
    p_tax_rate_id: id,
    p_tenant_id: tenantId,
  })

  if (rpcError) return NextResponse.json({ error: "Failed to set default tax rate" }, { status: 500 })

  const result = rpcResult as { success: boolean; error?: string } | null
  if (!result?.success) {
    const msg = result?.error ?? "Failed to set default tax rate"
    const status = msg.includes("not found") ? 404 : 400
    return NextResponse.json({ error: msg }, { status })
  }

  const { data: updated } = await supabase
    .from("tax_rates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("effective_from", { ascending: false })

  return NextResponse.json({ tax_rates: updated ?? [] }, { headers: { "cache-control": "no-store" } })
}
