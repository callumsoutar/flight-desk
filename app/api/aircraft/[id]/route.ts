import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import type { AircraftUpdate } from "@/lib/types/tables"

export const dynamic = "force-dynamic"

const totalTimeMethodSchema = z.enum([
  "hobbs",
  "tacho",
  "airswitch",
  "hobbs less 5%",
  "hobbs less 10%",
  "tacho less 5%",
  "tacho less 10%",
])

const aircraftUpdateSchema = z.strictObject({
  manufacturer: z.string().nullable().optional(),
  type: z.string().min(1).optional(),
  model: z.string().nullable().optional(),
  year_manufactured: z.number().int().min(1900).max(2100).nullable().optional(),
  registration: z.string().min(1).optional(),
  capacity: z.number().int().min(1).nullable().optional(),
  on_line: z.boolean().optional(),
  for_ato: z.boolean().optional(),
  prioritise_scheduling: z.boolean().optional(),
  aircraft_image_url: z.string().url().nullable().optional(),
  current_tach: z.number().min(0).nullable().optional(),
  current_hobbs: z.number().min(0).nullable().optional(),
  record_tacho: z.boolean().optional(),
  record_hobbs: z.boolean().optional(),
  record_airswitch: z.boolean().optional(),
  fuel_consumption: z.number().nullable().optional(),
  total_time_method: totalTimeMethodSchema.nullable().optional(),
  aircraft_type_id: z.string().uuid().nullable().optional(),
})

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const { data, error } = await supabase
    .from("aircraft")
    .select("*, aircraft_type:aircraft_types(id, name, category)")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    return noStoreJson({ error: "Aircraft not found" }, { status: 404 })
  }

  return noStoreJson({ aircraft: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = aircraftUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const updates = Object.fromEntries(
    Object.entries({
      ...parsed.data,
      // These columns are non-nullable in the DB; treat explicit null as "no change".
      current_hobbs: parsed.data.current_hobbs ?? undefined,
      current_tach: parsed.data.current_tach ?? undefined,
    }).filter(([, value]) => value !== undefined)
  ) as AircraftUpdate
  if (!Object.keys(updates).length) {
    return noStoreJson({ error: "No changes provided" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("aircraft")
    .update(updates)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("*, aircraft_type:aircraft_types(id, name, category)")
    .single()

  if (error) {
    return noStoreJson({ error: "Failed to update aircraft" }, { status: 500 })
  }

  return noStoreJson({ aircraft: data })
}
