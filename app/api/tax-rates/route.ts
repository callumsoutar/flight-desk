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

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

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

  const { data: taxRate, error: fetchError } = await supabase
    .from("tax_rates")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: "Failed to validate tax rate" }, { status: 500 })
  if (!taxRate) return NextResponse.json({ error: "Tax rate not found" }, { status: 404 })

  const { error: unsetError } = await supabase
    .from("tax_rates")
    .update({ is_default: false })
    .eq("tenant_id", tenantId)
    .neq("id", id)

  if (unsetError) return NextResponse.json({ error: "Failed to update tax rates" }, { status: 500 })

  const { error: setError } = await supabase
    .from("tax_rates")
    .update({ is_default: true })
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (setError) return NextResponse.json({ error: "Failed to set default tax rate" }, { status: 500 })

  const { data: updated } = await supabase
    .from("tax_rates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("effective_from", { ascending: false })

  return NextResponse.json({ tax_rates: updated ?? [] }, { headers: { "cache-control": "no-store" } })
}
