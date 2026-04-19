import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import type {
  AircraftMaintenanceVisitEntry,
  AircraftMaintenanceVisitsResponse,
} from "@/lib/types/maintenance-history"

export const dynamic = "force-dynamic"

type ComponentLite = {
  id: string
  name: string
}

function toDateOnlyString(value: string | null | undefined): string | null {
  if (!value) return null
  return value.slice(0, 10)
}

const updateVisitSchema = z.strictObject({
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

const createVisitSchema = z.strictObject({
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
  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

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
        return noStoreJson({ error: "Maintenance visit not found" }, { status: 404 })
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

      return noStoreJson({ ...visit, component })
    } catch {
      return noStoreJson({ error: "Failed to load maintenance visit" }, { status: 500 })
    }
  }

  const aircraftId = request.nextUrl.searchParams.get("aircraft_id")
  if (!aircraftId) {
    return noStoreJson({ error: "aircraft_id is required" }, { status: 400 })
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

    return noStoreJson(payload)
  } catch {
    return noStoreJson({ error: "Failed to load maintenance visits" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ access: "staff" })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = updateVisitSchema.safeParse(raw)
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
    .from("maintenance_visits")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error || !data) {
    return noStoreJson({ error: "Failed to update maintenance visit" }, { status: 500 })
  }

  return noStoreJson(data)
}

export async function POST(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ access: "staff" })
  if (session.response) return session.response
  const { supabase, user, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = createVisitSchema.safeParse(raw)
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
    return noStoreJson({ error: "Failed to log maintenance visit" }, { status: 500 })
  }

  if (payload.component_id) {
    const componentUpdates: Record<string, string | number | null> = {}

    if (payload.next_due_hours !== null && payload.next_due_hours !== undefined) {
      componentUpdates.current_due_hours = payload.next_due_hours
    }

    if (payload.next_due_date !== null && payload.next_due_date !== undefined) {
      componentUpdates.current_due_date = payload.next_due_date
    }

    const lastCompletedDate = toDateOnlyString(payload.visit_date)
    if (lastCompletedDate) {
      componentUpdates.last_completed_date = lastCompletedDate
    }

    if (payload.hours_at_visit !== null && payload.hours_at_visit !== undefined) {
      componentUpdates.last_completed_hours = payload.hours_at_visit
    }

    if (Object.keys(componentUpdates).length > 0) {
      const { error: componentError } = await supabase
        .from("aircraft_components")
        .update(componentUpdates)
        .eq("tenant_id", tenantId)
        .eq("aircraft_id", payload.aircraft_id)
        .eq("id", payload.component_id)

      if (componentError) {
        return noStoreJson(
          { error: "Maintenance logged, but failed to update component" },
          { status: 500 }
        )
      }
    }
  }

  return noStoreJson(data, { status: 201 })
}
