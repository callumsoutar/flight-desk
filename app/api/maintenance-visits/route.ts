import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type {
  AircraftMaintenanceVisitEntry,
  AircraftMaintenanceVisitsResponse,
} from "@/lib/types/maintenance-history"

export const dynamic = "force-dynamic"

type ComponentLite = {
  id: string
  name: string
}

const updateVisitSchema = z.object({
  id: z.string().uuid(),
  visit_date: z.string().optional(),
  visit_type: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  total_cost: z.number().nullable().optional(),
  hours_at_visit: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  date_out_of_maintenance: z.string().nullable().optional(),
  component_due_hours: z.number().nullable().optional(),
  component_due_date: z.string().nullable().optional(),
  next_due_hours: z.number().nullable().optional(),
  next_due_date: z.string().nullable().optional(),
})

const createVisitSchema = z.object({
  aircraft_id: z.string().uuid(),
  component_id: z.string().uuid().nullable().optional(),
  visit_date: z.string(),
  visit_type: z.string().min(1),
  description: z.string().min(1),
  total_cost: z.number().nullable().optional(),
  hours_at_visit: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  date_out_of_maintenance: z.string().nullable().optional(),
  performed_by: z.string().uuid().nullable().optional(),
  component_due_hours: z.number().nullable().optional(),
  component_due_date: z.string().nullable().optional(),
  next_due_hours: z.number().nullable().optional(),
  next_due_date: z.string().nullable().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const visitId = request.nextUrl.searchParams.get("maintenance_visit_id")
  if (visitId) {
    try {
      const { data: visit, error: visitError } = await supabase
        .from("maintenance_visits")
        .select(
          "*, performed_by_user:user_directory!maintenance_visits_performed_by_fkey(id, first_name, last_name, email)"
        )
        .eq("tenant_id", tenantId)
        .eq("id", visitId)
        .maybeSingle()

      if (visitError || !visit) {
        return NextResponse.json(
          { error: "Maintenance visit not found" },
          { status: 404, headers: { "cache-control": "no-store" } }
        )
      }

      let component: ComponentLite | null = null
      if (visit.component_id) {
        const { data: componentRow } = await supabase
          .from("aircraft_components")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .eq("id", visit.component_id)
          .maybeSingle()
        component = componentRow
      }

      return NextResponse.json(
        { ...visit, component },
        { headers: { "cache-control": "no-store" } }
      )
    } catch {
      return NextResponse.json(
        { error: "Failed to load maintenance visit" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }
  }

  const aircraftId = request.nextUrl.searchParams.get("aircraft_id")
  if (!aircraftId) {
    return NextResponse.json(
      { error: "aircraft_id is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const [visitsResult, componentsResult] = await Promise.all([
      supabase
        .from("maintenance_visits")
        .select(
          "*, performed_by_user:user_directory!maintenance_visits_performed_by_fkey(id, first_name, last_name, email)"
        )
        .eq("tenant_id", tenantId)
        .eq("aircraft_id", aircraftId)
        .order("visit_date", { ascending: false })
        .limit(500),
      supabase
        .from("aircraft_components")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("aircraft_id", aircraftId),
    ])

    if (visitsResult.error) {
      throw visitsResult.error
    }
    if (componentsResult.error) {
      throw componentsResult.error
    }

    const componentById = new Map<string, ComponentLite>()
    for (const component of componentsResult.data ?? []) {
      componentById.set(component.id, { id: component.id, name: component.name })
    }

    const visits: AircraftMaintenanceVisitEntry[] = (visitsResult.data ?? []).map((visit) => ({
      ...visit,
      component: visit.component_id ? componentById.get(visit.component_id) ?? null : null,
    }))

    const payload: AircraftMaintenanceVisitsResponse = { visits }

    return NextResponse.json(payload, {
      headers: { "cache-control": "no-store" },
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to load maintenance visits" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const raw = await request.json().catch(() => null)
  const parsed = updateVisitSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { id, ...rest } = parsed.data
  const updateData = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  )

  if (!Object.keys(updateData).length) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { data, error } = await supabase
    .from("maintenance_visits")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to update maintenance visit" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(data, { headers: { "cache-control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const raw = await request.json().catch(() => null)
  const parsed = createVisitSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const payload = parsed.data

  const { data: aircraft, error: aircraftError } = await supabase
    .from("aircraft")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", payload.aircraft_id)
    .maybeSingle()

  if (aircraftError || !aircraft) {
    return NextResponse.json(
      { error: "Aircraft not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  const performedBy = payload.performed_by ?? user.id

  const { data, error } = await supabase
    .from("maintenance_visits")
    .insert({
      tenant_id: tenantId,
      aircraft_id: payload.aircraft_id,
      component_id: payload.component_id ?? null,
      visit_date: payload.visit_date,
      visit_type: payload.visit_type,
      description: payload.description,
      total_cost: payload.total_cost ?? null,
      hours_at_visit: payload.hours_at_visit ?? null,
      notes: payload.notes ?? null,
      date_out_of_maintenance: payload.date_out_of_maintenance ?? null,
      performed_by: performedBy,
      component_due_hours: payload.component_due_hours ?? null,
      component_due_date: payload.component_due_date ?? null,
      next_due_hours: payload.next_due_hours ?? null,
      next_due_date: payload.next_due_date ?? null,
    })
    .select("*")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to log maintenance visit" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(data, { status: 201, headers: { "cache-control": "no-store" } })
}
