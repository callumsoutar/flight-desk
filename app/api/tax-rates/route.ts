import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

const patchSchema = z.strictObject({
  id: z.string().uuid(),
  is_default: z.literal(true),
})

const postSchema = z.strictObject({
  tax_name: z.string().min(1).max(64),
  rate_percent: z.coerce.number().min(0).max(100),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().max(200).optional(),
  region_code: z.string().max(20).optional(),
  make_default: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

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
    return noStoreJson({ error: "Failed to fetch tax rates" }, { status: 500 })
  }

  return noStoreJson({ tax_rates: data ?? [] })
}

export async function POST(request: NextRequest) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const body = await request.json().catch(() => null)
  if (body && typeof body.rate_percent === "string" && body.rate_percent.trim() === "") {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return noStoreJson({ error: "Invalid payload" }, { status: 400 })

  const taxName = parsed.data.tax_name.trim()
  if (!taxName) return noStoreJson({ error: "Invalid payload" }, { status: 400 })

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
    return noStoreJson({ error: "Failed to create tax rate" }, { status: 500 })
  }

  if (parsed.data.make_default) {
    const { data: rpcResult, error: rpcError } = await supabase.rpc("set_default_tax_rate", {
      p_tax_rate_id: created.id,
      p_tenant_id: tenantId,
    })

    if (rpcError) {
      return noStoreJson({ error: "Failed to set default tax rate" }, { status: 500 })
    }

    const result = rpcResult as { success: boolean; error?: string } | null
    if (!result?.success) {
      return noStoreJson({ error: result?.error ?? "Failed to set default tax rate" }, { status: 400 })
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
    return noStoreJson({ error: "Failed to fetch tax rates" }, { status: 500 })
  }

  return noStoreJson({ tax_rates: updated ?? [] })
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return noStoreJson({ error: "Invalid payload" }, { status: 400 })

  const { id } = parsed.data

  const { data: rpcResult, error: rpcError } = await supabase.rpc("set_default_tax_rate", {
    p_tax_rate_id: id,
    p_tenant_id: tenantId,
  })

  if (rpcError) return noStoreJson({ error: "Failed to set default tax rate" }, { status: 500 })

  const result = rpcResult as { success: boolean; error?: string } | null
  if (!result?.success) {
    const msg = result?.error ?? "Failed to set default tax rate"
    const status = msg.includes("not found") ? 404 : 400
    return noStoreJson({ error: msg }, { status })
  }

  const { data: updated } = await supabase
    .from("tax_rates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("effective_from", { ascending: false })

  return noStoreJson({ tax_rates: updated ?? [] })
}
