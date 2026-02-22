import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { equipmentCreateSchema } from "@/lib/validation/equipment"

export const dynamic = "force-dynamic"

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

function optionalTrimmedValue(value?: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: NextRequest) {
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
      { error: "Only staff can add equipment" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const parsed = equipmentCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const payload = parsed.data

  const serialNumber = optionalTrimmedValue(payload.serial_number)
  if (serialNumber) {
    const { data: existing, error: existingError } = await supabase
      .from("equipment")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("serial_number", serialNumber)
      .is("voided_at", null)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to validate serial number" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    if (existing) {
      return NextResponse.json(
        { error: "Equipment with that serial number already exists" },
        { status: 409, headers: { "cache-control": "no-store" } }
      )
    }
  }

  const { data: equipment, error: createError } = await supabase
    .from("equipment")
    .insert({
      tenant_id: tenantId,
      name: payload.name.trim(),
      label: optionalTrimmedValue(payload.label),
      type: payload.type,
      status: payload.status,
      serial_number: serialNumber,
      location: optionalTrimmedValue(payload.location),
      notes: optionalTrimmedValue(payload.notes),
      year_purchased: payload.year_purchased ?? null,
    })
    .select("*")
    .maybeSingle()

  if (createError || !equipment) {
    return NextResponse.json(
      { error: "Failed to add equipment" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { equipment },
    { status: 201, headers: { "cache-control": "no-store" } }
  )
}
