import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const createIssueSchema = z.object({
  equipment_id: z.string().uuid("Invalid equipment id"),
  user_id: z.string().uuid("Invalid user id"),
  expected_return: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

const returnIssueSchema = z.object({
  issuance_id: z.string().uuid("Invalid issuance id"),
  notes: z.string().trim().optional().nullable(),
})

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
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
      { error: "Only staff can issue equipment" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const parsed = createIssueSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const payload = parsed.data
  const expectedReturn =
    payload.expected_return && payload.expected_return.length > 0
      ? dateInputToUtcIso(payload.expected_return)
      : null

  if (payload.expected_return && !expectedReturn) {
    return NextResponse.json(
      { error: "Expected return date is invalid" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: equipment, error: equipmentError } = await supabase
    .from("equipment")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", payload.equipment_id)
    .is("voided_at", null)
    .maybeSingle()

  if (equipmentError || !equipment) {
    return NextResponse.json(
      { error: "Equipment was not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: member, error: memberError } = await supabase
    .from("tenant_users")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", payload.user_id)
    .eq("is_active", true)
    .maybeSingle()

  if (memberError || !member) {
    return NextResponse.json(
      { error: "Selected member was not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
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
    return NextResponse.json(
      { error: "Failed to validate issuance state" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  if (existingIssuance) {
    return NextResponse.json(
      { error: "Equipment is already issued" },
      { status: 409, headers: { "cache-control": "no-store" } }
    )
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
    return NextResponse.json(
      { error: "Failed to issue equipment" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { issuance },
    { status: 201, headers: { "cache-control": "no-store" } }
  )
}

export async function PATCH(request: NextRequest) {
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
      { error: "Only staff can return equipment" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const parsed = returnIssueSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
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
    return NextResponse.json(
      { error: "Failed to validate issuance state" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
  if (!issuance) {
    return NextResponse.json(
      { error: "Active issuance was not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
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
    return NextResponse.json(
      { error: "Failed to return equipment" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { issuance: updatedIssuance },
    { status: 200, headers: { "cache-control": "no-store" } }
  )
}
