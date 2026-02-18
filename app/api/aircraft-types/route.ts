import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const createAircraftTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
})

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("aircraft_types")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: "Failed to fetch aircraft types" }, { status: 500 })
  }

  return NextResponse.json({ aircraft_types: data ?? [] }, { headers: { "cache-control": "no-store" } })
}

export async function POST(request: NextRequest) {
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
  const parsed = createAircraftTypeSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("aircraft_types")
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      category: parsed.data.category || null,
      description: parsed.data.description || null,
    })
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to create aircraft type" }, { status: 500 })
  }

  return NextResponse.json({ aircraft_type: data }, { status: 201 })
}
