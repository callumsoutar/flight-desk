import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"
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

const aircraftUpdateSchema = z.object({
  manufacturer: z.string().nullable().optional(),
  type: z.string().min(1).optional(),
  model: z.string().nullable().optional(),
  year_manufactured: z.number().int().min(1900).max(2100).nullable().optional(),
  registration: z.string().min(1).optional(),
  status: z.string().nullable().optional(),
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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
  const parsed = aircraftUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
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
    return NextResponse.json({ error: "No changes provided" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("aircraft")
    .update(updates)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("*, aircraft_type:aircraft_types(id, name, category)")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to update aircraft" }, { status: 500 })
  }

  return NextResponse.json({ aircraft: data })
}
