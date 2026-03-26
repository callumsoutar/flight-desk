import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

const createIssueSchema = z.strictObject({
  equipment_id: z.string().uuid("Invalid equipment id"),
  user_id: z.string().uuid("Invalid user id"),
  expected_return: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

const returnIssueSchema = z.strictObject({
  issuance_id: z.string().uuid("Invalid issuance id"),
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

function mergeReturnNotes(existingNotes: string | null, returnNotes: string | null): string | null {
  if (!returnNotes) return existingNotes
  if (!existingNotes) return returnNotes
  return `${existingNotes}\n\nReturn notes:\n${returnNotes}`
}

export async function GET(request: NextRequest) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const equipmentId = request.nextUrl.searchParams.get("equipmentId")
  if (!equipmentId || !z.string().uuid().safeParse(equipmentId).success) {
    return noStoreJson({ error: "Invalid equipment id" }, { status: 400 })
  }

  const { data: issuances, error: issuanceError } = await supabase
    .from("equipment_issuance")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("equipment_id", equipmentId)
    .order("issued_at", { ascending: false })

  if (issuanceError) {
    return noStoreJson({ error: "Failed to load equipment issuance history" }, { status: 500 })
  }

  const safeIssuances = issuances ?? []
  if (safeIssuances.length === 0) {
    return noStoreJson({ issuances: [], userMap: {} })
  }

  const userIds = Array.from(new Set(safeIssuances.flatMap((row) => [row.user_id, row.issued_by])))
  const { data: users, error: usersError } = await supabase
    .from("user_directory")
    .select("id, first_name, last_name, email")
    .in("id", userIds)

  if (usersError) {
    return noStoreJson({ error: "Failed to load issuance users" }, { status: 500 })
  }

  const userMap: Record<string, string> = {}
  for (const user of users ?? []) {
    if (!user.id) continue
    userMap[user.id] = toDisplayName(user)
  }

  return noStoreJson({ issuances: safeIssuances, userMap })
}

export async function POST(request: NextRequest) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, user, tenantId } = session.context

  const parsed = createIssueSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data
  const expectedReturn =
    payload.expected_return && payload.expected_return.length > 0
      ? dateInputToUtcIso(payload.expected_return)
      : null

  if (payload.expected_return && !expectedReturn) {
    return noStoreJson({ error: "Expected return date is invalid" }, { status: 400 })
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

  const { data: member, error: memberError } = await supabase
    .from("tenant_users")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", payload.user_id)
    .eq("is_active", true)
    .maybeSingle()

  if (memberError || !member) {
    return noStoreJson({ error: "Selected member was not found" }, { status: 404 })
  }

  const { data: existingIssuance, error: issuanceCheckError } = await supabase
    .from("equipment_issuance")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("equipment_id", payload.equipment_id)
    .is("returned_at", null)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (issuanceCheckError) {
    return noStoreJson({ error: "Failed to validate issuance state" }, { status: 500 })
  }

  if (existingIssuance) {
    return noStoreJson({ error: "Equipment is already issued" }, { status: 409 })
  }

  const notes = payload.notes?.trim() || null

  const { data: issuance, error: createError } = await supabase
    .from("equipment_issuance")
    .insert({
      tenant_id: tenantId,
      equipment_id: payload.equipment_id,
      user_id: payload.user_id,
      issued_by: user.id,
      expected_return: expectedReturn,
      notes,
    })
    .select("id")
    .maybeSingle()

  if (createError || !issuance) {
    return noStoreJson({ error: "Failed to issue equipment" }, { status: 500 })
  }

  return noStoreJson({ issuance }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const parsed = returnIssueSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data
  const { data: issuance, error: issuanceError } = await supabase
    .from("equipment_issuance")
    .select("id, notes")
    .eq("tenant_id", tenantId)
    .eq("id", payload.issuance_id)
    .is("returned_at", null)
    .maybeSingle()

  if (issuanceError) {
    return noStoreJson({ error: "Failed to validate issuance state" }, { status: 500 })
  }
  if (!issuance) {
    return noStoreJson({ error: "Active issuance was not found" }, { status: 404 })
  }

  const returnNotes = payload.notes?.trim() || null
  const mergedNotes = mergeReturnNotes(issuance.notes ?? null, returnNotes)

  const { data: updatedIssuance, error: updateError } = await supabase
    .from("equipment_issuance")
    .update({
      returned_at: new Date().toISOString(),
      notes: mergedNotes,
    })
    .eq("tenant_id", tenantId)
    .eq("id", payload.issuance_id)
    .is("returned_at", null)
    .select("id")
    .maybeSingle()

  if (updateError || !updatedIssuance) {
    return noStoreJson({ error: "Failed to return equipment" }, { status: 500 })
  }

  return noStoreJson({ issuance: updatedIssuance }, { status: 200 })
}
