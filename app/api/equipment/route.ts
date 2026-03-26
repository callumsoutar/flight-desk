import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchEquipment } from "@/lib/equipment/fetch-equipment"
import { EQUIPMENT_STATUS_OPTIONS, EQUIPMENT_TYPE_OPTIONS } from "@/lib/types/equipment"
import type { EquipmentStatus, EquipmentType } from "@/lib/types/equipment"
import { equipmentCreateSchema } from "@/lib/validation/equipment"

export const dynamic = "force-dynamic"

function optionalTrimmedValue(value?: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const equipmentStatuses = new Set(EQUIPMENT_STATUS_OPTIONS.map((option) => option.value))
const equipmentTypes = new Set(EQUIPMENT_TYPE_OPTIONS.map((option) => option.value))

function isEquipmentStatus(value: string): value is EquipmentStatus {
  return equipmentStatuses.has(value as EquipmentStatus)
}

function isEquipmentType(value: string): value is EquipmentType {
  return equipmentTypes.has(value as EquipmentType)
}

export async function GET(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ access: "authenticated" })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const params = request.nextUrl.searchParams
  const status = params.get("status")
  const type = params.get("type")
  const search = params.get("search")
  const issued = params.get("issued")

  const filters = {
    status: status && isEquipmentStatus(status) ? status : undefined,
    type: type && isEquipmentType(type) ? type : undefined,
    search: search?.trim() || undefined,
    issued: issued === "true" ? true : issued === "false" ? false : undefined,
  }

  try {
    const equipment = await fetchEquipment(supabase, tenantId, filters)
    return noStoreJson({ equipment })
  } catch {
    return noStoreJson({ error: "Failed to fetch equipment" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const parsed = equipmentCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
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
      return noStoreJson({ error: "Failed to validate serial number" }, { status: 500 })
    }

    if (existing) {
      return noStoreJson({ error: "Equipment with that serial number already exists" }, { status: 409 })
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
    return noStoreJson({ error: "Failed to add equipment" }, { status: 500 })
  }

  return noStoreJson({ equipment }, { status: 201 })
}
