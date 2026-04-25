import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

const createObservationSchema = z.strictObject({
  aircraft_id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  stage: z.enum(["open", "investigation", "resolution", "closed"]).optional(),
})

const updateObservationSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  stage: z.enum(["open", "investigation", "resolution", "closed"]).optional(),
  resolution_comments: z.string().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
})

export async function GET(request: NextRequest) {
  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const observationId = request.nextUrl.searchParams.get("id")
  if (observationId) {
    const { data, error } = await supabase
      .from("observations")
      .select(
        "*, reported_by_user:user_directory!observations_reported_by_fkey(id, first_name, last_name, email), assigned_to_user:user_directory!observations_assigned_to_fkey(id, first_name, last_name, email)"
      )
      .eq("tenant_id", tenantId)
      .eq("id", observationId)
      .maybeSingle()

    if (error || !data) {
      return noStoreJson({ error: "Observation not found" }, { status: 404 })
    }

    return noStoreJson(data)
  }

  const aircraftId = request.nextUrl.searchParams.get("aircraft_id")
  if (!aircraftId) {
    return noStoreJson({ error: "aircraft_id is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("observations")
    .select(
      "*, reported_by_user:user_directory!observations_reported_by_fkey(id, first_name, last_name, email), assigned_to_user:user_directory!observations_assigned_to_fkey(id, first_name, last_name, email)"
    )
    .eq("tenant_id", tenantId)
    .eq("aircraft_id", aircraftId)
    .order("reported_date", { ascending: false })
    .limit(500)

  if (error) {
    return noStoreJson({ error: "Failed to load observations" }, { status: 500 })
  }

  return noStoreJson(data ?? [])
}

export async function POST(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ access: "staff" })
  if (session.response) return session.response
  const { supabase, user, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = createObservationSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const { data: aircraft, error: aircraftError } = await supabase
    .from("aircraft")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", parsed.data.aircraft_id)
    .is("voided_at", null)
    .maybeSingle()

  if (aircraftError || !aircraft) {
    return noStoreJson({ error: "Aircraft not found" }, { status: 404 })
  }

  const { data: inserted, error } = await supabase
    .from("observations")
    .insert({
      tenant_id: tenantId,
      aircraft_id: parsed.data.aircraft_id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      priority: parsed.data.priority ?? "medium",
      stage: parsed.data.stage ?? "open",
      reported_by: user.id,
      reported_date: new Date().toISOString(),
    })
    .select(
      "*, reported_by_user:user_directory!observations_reported_by_fkey(id, first_name, last_name, email), assigned_to_user:user_directory!observations_assigned_to_fkey(id, first_name, last_name, email)"
    )
    .single()

  if (error) {
    return noStoreJson({ error: "Failed to create observation" }, { status: 500 })
  }

  return noStoreJson(inserted, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ access: "staff" })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = updateObservationSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data
  const updateData: Record<string, string | null> = {}

  if (payload.name !== undefined) updateData.name = payload.name
  if (payload.description !== undefined) updateData.description = payload.description || null
  if (payload.priority !== undefined) updateData.priority = payload.priority
  if (payload.resolution_comments !== undefined) {
    updateData.resolution_comments = payload.resolution_comments || null
  }

  // `stage` is the canonical lifecycle field; `resolved_at` stays in sync for audit/history.
  let mergedStage = payload.stage
  let mergedResolvedAt = payload.resolved_at

  if (mergedStage === undefined && mergedResolvedAt !== undefined && mergedResolvedAt) {
    mergedStage = "closed"
  }

  if (mergedStage === "closed" && mergedResolvedAt === undefined) {
    mergedResolvedAt = new Date().toISOString()
  }

  if (mergedStage !== undefined && mergedStage !== "closed" && mergedResolvedAt === undefined) {
    mergedResolvedAt = null
  }

  if (mergedResolvedAt !== undefined && mergedResolvedAt && mergedStage === undefined) {
    mergedStage = "closed"
  }

  if (mergedStage !== undefined) updateData.stage = mergedStage
  if (mergedResolvedAt !== undefined) updateData.resolved_at = mergedResolvedAt

  if (!Object.keys(updateData).length) {
    return noStoreJson({ error: "No fields to update" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("observations")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", payload.id)
    .select(
      "*, reported_by_user:user_directory!observations_reported_by_fkey(id, first_name, last_name, email), assigned_to_user:user_directory!observations_assigned_to_fkey(id, first_name, last_name, email)"
    )
    .maybeSingle()

  if (error || !data) {
    return noStoreJson({ error: "Failed to update observation" }, { status: 500 })
  }

  return noStoreJson(data)
}
