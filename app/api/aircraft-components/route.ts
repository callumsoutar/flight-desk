import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

const createSchema = z.strictObject({
  aircraft_id: z.string().uuid(),
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  component_type: z.enum([
    "battery",
    "inspection",
    "service",
    "engine",
    "fuselage",
    "avionics",
    "elt",
    "propeller",
    "landing_gear",
    "other",
  ]),
  interval_type: z.enum(["HOURS", "CALENDAR", "BOTH"]).optional(),
  interval_hours: z.number().nullable().optional(),
  interval_days: z.number().nullable().optional(),
  current_due_date: z.string().nullable().optional(),
  current_due_hours: z.number().nullable().optional(),
  last_completed_date: z.string().nullable().optional(),
  last_completed_hours: z.number().nullable().optional(),
  status: z.enum(["active", "inactive", "removed"]).optional(),
  priority: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const updateSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  component_type: z
    .enum([
      "battery",
      "inspection",
      "service",
      "engine",
      "fuselage",
      "avionics",
      "elt",
      "propeller",
      "landing_gear",
      "other",
    ])
    .optional(),
  interval_type: z.enum(["HOURS", "CALENDAR", "BOTH"]).optional(),
  interval_hours: z.number().nullable().optional(),
  interval_days: z.number().nullable().optional(),
  current_due_date: z.string().nullable().optional(),
  current_due_hours: z.number().nullable().optional(),
  last_completed_date: z.string().nullable().optional(),
  last_completed_hours: z.number().nullable().optional(),
  status: z.enum(["active", "inactive", "removed"]).optional(),
  priority: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  extension_limit_hours: z.number().nullable().optional(),
})

export async function GET(request: NextRequest) {
  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const componentId = request.nextUrl.searchParams.get("id")
  if (componentId) {
    const { data, error } = await supabase
      .from("aircraft_components")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", componentId)
      .is("voided_at", null)
      .maybeSingle()

    if (error || !data) {
      return noStoreJson({ error: "Component not found" }, { status: 404 })
    }
    return noStoreJson(data)
  }

  const aircraftId = request.nextUrl.searchParams.get("aircraft_id")
  if (!aircraftId) {
    return noStoreJson({ error: "aircraft_id is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("aircraft_components")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("aircraft_id", aircraftId)
    .is("voided_at", null)
    .order("name", { ascending: true })

  if (error) {
    return noStoreJson({ error: "Failed to load components" }, { status: 500 })
  }

  return noStoreJson(data ?? [])
}

export async function POST(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ access: "staff" })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data

  const { data: aircraft, error: aircraftError } = await supabase
    .from("aircraft")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", payload.aircraft_id)
    .is("voided_at", null)
    .maybeSingle()

  if (aircraftError || !aircraft) {
    return noStoreJson({ error: "Aircraft not found" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("aircraft_components")
    .insert({
      tenant_id: tenantId,
      aircraft_id: payload.aircraft_id,
      name: payload.name,
      description: payload.description ?? null,
      component_type: payload.component_type,
      interval_type: payload.interval_type ?? "HOURS",
      interval_hours: payload.interval_hours ?? null,
      interval_days: payload.interval_days ?? null,
      current_due_date: payload.current_due_date ?? null,
      current_due_hours: payload.current_due_hours ?? null,
      last_completed_date: payload.last_completed_date ?? null,
      last_completed_hours: payload.last_completed_hours ?? null,
      status: payload.status ?? "active",
      priority: payload.priority ?? "MEDIUM",
      notes: payload.notes ?? null,
    })
    .select("*")
    .single()

  if (error || !data) {
    return noStoreJson({ error: "Failed to create maintenance item" }, { status: 500 })
  }

  return noStoreJson(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ access: "staff" })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const { id, ...rest } = parsed.data
  const updateData = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  )

  if (!Object.keys(updateData).length) {
    return noStoreJson({ error: "No fields to update" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("aircraft_components")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error || !data) {
    return noStoreJson({ error: "Failed to update maintenance item" }, { status: 500 })
  }

  return noStoreJson(data)
}
