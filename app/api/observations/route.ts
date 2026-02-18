import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const createObservationSchema = z.object({
  aircraft_id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  stage: z.enum(["open", "investigation", "resolution", "closed"]).optional(),
})

const updateObservationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  stage: z.enum(["open", "investigation", "resolution", "closed"]).optional(),
  resolution_comments: z.string().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  }

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
      return NextResponse.json({ error: "Observation not found" }, { status: 404 })
    }

    return NextResponse.json(data, { headers: { "cache-control": "no-store" } })
  }

  const aircraftId = request.nextUrl.searchParams.get("aircraft_id")
  if (!aircraftId) {
    return NextResponse.json({ error: "aircraft_id is required" }, { status: 400 })
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
    return NextResponse.json({ error: "Failed to load observations" }, { status: 500 })
  }

  return NextResponse.json(data ?? [], { headers: { "cache-control": "no-store" } })
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
  const parsed = createObservationSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { data: aircraft, error: aircraftError } = await supabase
    .from("aircraft")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", parsed.data.aircraft_id)
    .maybeSingle()

  if (aircraftError || !aircraft) {
    return NextResponse.json({ error: "Aircraft not found" }, { status: 404 })
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
    return NextResponse.json({ error: "Failed to create observation" }, { status: 500 })
  }

  return NextResponse.json(inserted, { status: 201 })
}

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
  const parsed = updateObservationSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data
  const updateData: Record<string, string | null> = {}

  if (payload.name !== undefined) updateData.name = payload.name
  if (payload.description !== undefined) updateData.description = payload.description || null
  if (payload.priority !== undefined) updateData.priority = payload.priority
  if (payload.stage !== undefined) updateData.stage = payload.stage
  if (payload.resolution_comments !== undefined) {
    updateData.resolution_comments = payload.resolution_comments || null
  }

  if (payload.resolved_at !== undefined) {
    updateData.resolved_at = payload.resolved_at
  } else if (payload.stage !== undefined) {
    updateData.resolved_at = payload.stage === "closed" ? new Date().toISOString() : null
  }

  if (!Object.keys(updateData).length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
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
    return NextResponse.json({ error: "Failed to update observation" }, { status: 500 })
  }

  return NextResponse.json(data)
}
