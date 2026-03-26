import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

const createAircraftTypeSchema = z.strictObject({
  name: z.string().trim().min(1, "Name is required"),
  category: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
})

export async function GET() {
  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const { data, error } = await supabase
    .from("aircraft_types")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })

  if (error) {
    return noStoreJson({ error: "Failed to fetch aircraft types" }, { status: 500 })
  }

  return noStoreJson({ aircraft_types: data ?? [] })
}

export async function POST(request: NextRequest) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = createAircraftTypeSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
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
    return noStoreJson({ error: "Failed to create aircraft type" }, { status: 500 })
  }

  return noStoreJson({ aircraft_type: data }, { status: 201 })
}
