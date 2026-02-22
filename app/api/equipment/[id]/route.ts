import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
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

const equipmentUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255).optional(),
  label: z.string().trim().max(255).nullable().optional(),
  serial_number: z.string().trim().max(255).nullable().optional(),
  location: z.string().trim().max(255).nullable().optional(),
  status: equipmentStatusSchema.optional(),
  type: equipmentTypeSchema.optional(),
  notes: z.string().trim().nullable().optional(),
})

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

function canDelete(role: string | null) {
  return role === "owner" || role === "admin"
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, {
    includeTenant: true,
    requireUser: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: "Failed to load equipment" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
  if (!data) {
    return NextResponse.json(
      { error: "Equipment not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json({ equipment: data }, { headers: { "cache-control": "no-store" } })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }
  if (!isStaff(role)) {
    return NextResponse.json(
      { error: "Only staff can update equipment" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const parsed = equipmentUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const updatePayload = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined)
  ) as EquipmentUpdate

  if (!Object.keys(updatePayload).length) {
    return NextResponse.json(
      { error: "No changes provided" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
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
    return NextResponse.json(
      { error: "Failed to update equipment" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
  if (!data) {
    return NextResponse.json(
      { error: "Equipment not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json({ equipment: data }, { headers: { "cache-control": "no-store" } })
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }
  if (!canDelete(role)) {
    return NextResponse.json(
      { error: "Only owners and admins can delete equipment" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: equipment, error: equipmentError } = await supabase
    .from("equipment")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (equipmentError) {
    return NextResponse.json(
      { error: "Failed to load equipment" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
  if (!equipment) {
    return NextResponse.json(
      { error: "Equipment not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
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
    return NextResponse.json(
      { error: "Failed to validate equipment issuance state" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
  if (activeIssuance) {
    return NextResponse.json(
      { error: "Equipment cannot be deleted while it is issued" },
      { status: 409, headers: { "cache-control": "no-store" } }
    )
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
    return NextResponse.json(
      { error: "Failed to delete equipment" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { success: true },
    { status: 200, headers: { "cache-control": "no-store" } }
  )
}
