import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import type { EquipmentUpdate } from "@/lib/types"

export const dynamic = "force-dynamic"

const equipmentTypeSchema = z.enum([
  "AIP",
  "Stationery",
  "Headset",
  "Technology",
  "Maps",
  "Radio",
  "Transponder",
  "ELT",
  "Lifejacket",
  "FirstAidKit",
  "FireExtinguisher",
  "Other",
])

const equipmentStatusSchema = z.enum(["active", "maintenance", "lost", "retired"])

const equipmentUpdateSchema = z.strictObject({
  name: z.string().trim().min(1, "Name is required").max(255).optional(),
  label: z.string().trim().max(255).nullable().optional(),
  serial_number: z.string().trim().max(255).nullable().optional(),
  location: z.string().trim().max(255).nullable().optional(),
  status: equipmentStatusSchema.optional(),
  type: equipmentTypeSchema.optional(),
  notes: z.string().trim().nullable().optional(),
})

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (error) {
    return noStoreJson({ error: "Failed to load equipment" }, { status: 500 })
  }
  if (!data) {
    return noStoreJson({ error: "Equipment not found" }, { status: 404 })
  }

  return noStoreJson({ equipment: data })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const parsed = equipmentUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const updatePayload = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined)
  ) as EquipmentUpdate

  if (!Object.keys(updatePayload).length) {
    return noStoreJson({ error: "No changes provided" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("equipment")
    .update(updatePayload)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .select("*")
    .maybeSingle()

  if (error) {
    return noStoreJson({ error: "Failed to update equipment" }, { status: 500 })
  }
  if (!data) {
    return noStoreJson({ error: "Equipment not found" }, { status: 404 })
  }

  return noStoreJson({ equipment: data })
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const { data: equipment, error: equipmentError } = await supabase
    .from("equipment")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (equipmentError) {
    return noStoreJson({ error: "Failed to load equipment" }, { status: 500 })
  }
  if (!equipment) {
    return noStoreJson({ error: "Equipment not found" }, { status: 404 })
  }

  const { data: activeIssuance, error: issuanceError } = await supabase
    .from("equipment_issuance")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("equipment_id", id)
    .is("returned_at", null)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (issuanceError) {
    return noStoreJson({ error: "Failed to validate equipment issuance state" }, { status: 500 })
  }
  if (activeIssuance) {
    return noStoreJson({ error: "Equipment cannot be deleted while it is issued" }, { status: 409 })
  }

  const { data, error } = await supabase
    .from("equipment")
    .update({ voided_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .select("id")
    .maybeSingle()

  if (error || !data) {
    return noStoreJson({ error: "Failed to delete equipment" }, { status: 500 })
  }

  return noStoreJson({ success: true }, { status: 200 })
}
