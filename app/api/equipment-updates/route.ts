import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

const createUpdateSchema = z.strictObject({
  equipment_id: z.string().uuid("Invalid equipment id"),
  next_due_at: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

function toDisplayName(user: {
  id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
}) {
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
  if (fullName.length > 0) return fullName
  if (user.email && user.email.length > 0) return user.email
  return user.id ?? ""
}

function dateInputToUtcIso(value: string): string | null {
  const [yearRaw, monthRaw, dayRaw] = value.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (!year || !month || !day) return null

  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export async function GET(request: NextRequest) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const equipmentId = request.nextUrl.searchParams.get("equipmentId")
  if (!equipmentId || !z.string().uuid().safeParse(equipmentId).success) {
    return noStoreJson({ error: "Invalid equipment id" }, { status: 400 })
  }

  const { data: updates, error: updatesError } = await supabase
    .from("equipment_updates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("equipment_id", equipmentId)
    .order("updated_at", { ascending: false })

  if (updatesError) {
    return noStoreJson({ error: "Failed to load equipment updates history" }, { status: 500 })
  }

  const safeUpdates = updates ?? []
  if (safeUpdates.length === 0) {
    return noStoreJson({ updates: [], userMap: {} })
  }

  const userIds = Array.from(new Set(safeUpdates.map((row) => row.updated_by)))
  const { data: users, error: usersError } = await supabase
    .from("user_directory")
    .select("id, first_name, last_name, email")
    .in("id", userIds)

  if (usersError) {
    return noStoreJson({ error: "Failed to load update users" }, { status: 500 })
  }

  const userMap: Record<string, string> = {}
  for (const user of users ?? []) {
    if (!user.id) continue
    userMap[user.id] = toDisplayName(user)
  }

  return noStoreJson({ updates: safeUpdates, userMap })
}

export async function POST(request: NextRequest) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, user, tenantId } = session.context

  const parsed = createUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data
  const nextDueAt =
    payload.next_due_at && payload.next_due_at.length > 0 ? dateInputToUtcIso(payload.next_due_at) : null

  if (payload.next_due_at && !nextDueAt) {
    return noStoreJson({ error: "Next due date is invalid" }, { status: 400 })
  }

  const { data: equipment, error: equipmentError } = await supabase
    .from("equipment")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", payload.equipment_id)
    .is("voided_at", null)
    .maybeSingle()

  if (equipmentError || !equipment) {
    return noStoreJson({ error: "Equipment was not found" }, { status: 404 })
  }

  const notes = payload.notes?.trim() || null

  const { data: update, error: createError } = await supabase
    .from("equipment_updates")
    .insert({
      tenant_id: tenantId,
      equipment_id: payload.equipment_id,
      updated_by: user.id,
      next_due_at: nextDueAt,
      notes,
    })
    .select("id")
    .maybeSingle()

  if (createError || !update) {
    return noStoreJson({ error: "Failed to create equipment update" }, { status: 500 })
  }

  return noStoreJson({ update }, { status: 201 })
}
