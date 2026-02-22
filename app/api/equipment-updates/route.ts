import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const createUpdateSchema = z.object({
  equipment_id: z.string().uuid("Invalid equipment id"),
  next_due_at: z.string().trim().optional().nullable(),
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
      { error: "Only staff can log equipment updates" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const parsed = createUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const payload = parsed.data
  const nextDueAt =
    payload.next_due_at && payload.next_due_at.length > 0 ? dateInputToUtcIso(payload.next_due_at) : null

  if (payload.next_due_at && !nextDueAt) {
    return NextResponse.json(
      { error: "Next due date is invalid" },
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
    return NextResponse.json(
      { error: "Failed to create equipment update" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json({ update }, { status: 201, headers: { "cache-control": "no-store" } })
}
