import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int().min(1),
    })
  ),
})

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = reorderSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const items = parsed.data.items
  if (!items.length) {
    return NextResponse.json({ error: "No aircraft to reorder" }, { status: 400 })
  }

  const ids = items.map((item) => item.id)

  const { data: existing, error: existingError } = await supabase
    .from("aircraft")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("id", ids)

  if (existingError) {
    return NextResponse.json({ error: "Failed to validate aircraft list" }, { status: 500 })
  }

  const existingIds = new Set((existing ?? []).map((row) => row.id))
  if (existingIds.size !== ids.length) {
    return NextResponse.json({ error: "One or more aircraft were not found" }, { status: 404 })
  }

  for (const item of items) {
    const { error } = await supabase
      .from("aircraft")
      .update({ order: item.order })
      .eq("tenant_id", tenantId)
      .eq("id", item.id)

    if (error) {
      return NextResponse.json({ error: "Failed to update aircraft order" }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
