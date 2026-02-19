import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getAuthSession } from "@/lib/auth/session"
import { fetchAircraft } from "@/lib/aircraft/fetch-aircraft"

const querySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  aircraft_type_id: z.string().optional(),
})

const createSchema = z.object({
  registration: z.string().trim().min(1).max(20),
  type: z.string().trim().min(1).max(100),
  model: z.string().trim().max(100).nullable().optional(),
  manufacturer: z.string().trim().max(100).nullable().optional(),
  year_manufactured: z.number().int().min(1900).max(2100).nullable().optional(),
  status: z.string().trim().max(50).nullable().optional(),
  aircraft_type_id: z.string().uuid().nullable().optional(),
  total_time_method: z
    .enum([
      "hobbs",
      "tacho",
      "airswitch",
      "hobbs less 5%",
      "hobbs less 10%",
      "tacho less 5%",
      "tacho less 10%",
    ])
    .nullable()
    .optional(),
  current_hobbs: z.number().min(0).optional(),
  current_tach: z.number().min(0).optional(),
  on_line: z.boolean().optional(),
  prioritise_scheduling: z.boolean().optional(),
  record_hobbs: z.boolean().optional(),
  record_tacho: z.boolean().optional(),
  record_airswitch: z.boolean().optional(),
})

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const rawQuery = Object.fromEntries(url.searchParams.entries())
  const parsedQuery = querySchema.safeParse(rawQuery)

  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Forbidden: Missing tenant context" },
      { status: 403 }
    )
  }

  try {
    const aircraft = await fetchAircraft(supabase, tenantId, parsedQuery.data)
    return NextResponse.json(
      { aircraft },
      { headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch aircraft" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!tenantId) {
    return NextResponse.json(
      { error: "Forbidden: Missing tenant context" },
      { status: 403 }
    )
  }

  const raw = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data

  const { data: duplicate, error: duplicateError } = await supabase
    .from("aircraft")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike("registration", payload.registration)
    .maybeSingle()

  if (duplicateError) {
    return NextResponse.json({ error: "Failed to validate registration" }, { status: 500 })
  }
  if (duplicate) {
    return NextResponse.json(
      { error: "An aircraft with that registration already exists." },
      { status: 409 }
    )
  }

  if (payload.aircraft_type_id) {
    const { data: aircraftType, error: aircraftTypeError } = await supabase
      .from("aircraft_types")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", payload.aircraft_type_id)
      .maybeSingle()

    if (aircraftTypeError || !aircraftType) {
      return NextResponse.json({ error: "Aircraft type not found" }, { status: 404 })
    }
  }

  const { data, error } = await supabase
    .from("aircraft")
    .insert({
      tenant_id: tenantId,
      registration: payload.registration.trim(),
      type: payload.type.trim(),
      model: payload.model ?? null,
      manufacturer: payload.manufacturer ?? null,
      year_manufactured: payload.year_manufactured ?? null,
      status: payload.status ?? "active",
      aircraft_type_id: payload.aircraft_type_id ?? null,
      total_time_method: payload.total_time_method ?? "hobbs",
      current_hobbs: payload.current_hobbs ?? 0,
      current_tach: payload.current_tach ?? 0,
      total_time_in_service: 0,
      on_line: payload.on_line ?? true,
      prioritise_scheduling: payload.prioritise_scheduling ?? false,
      record_hobbs: payload.record_hobbs ?? true,
      record_tacho: payload.record_tacho ?? true,
      record_airswitch: payload.record_airswitch ?? false,
      for_ato: false,
    })
    .select("id")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create aircraft" }, { status: 500 })
  }

  return NextResponse.json({ aircraft: data }, { status: 201 })
}
