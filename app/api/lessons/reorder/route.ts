import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const payloadSchema = z.object({
  syllabus_id: z.string().uuid(),
  lesson_orders: z.array(z.object({ id: z.string().uuid(), order: z.number().int().min(1).max(10000) })).min(1),
})

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const raw = await request.json().catch(() => null)
  const parsed = payloadSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { syllabus_id: syllabusId, lesson_orders: lessonOrders } = parsed.data

  const idSet = new Set(lessonOrders.map((item) => item.id))
  if (idSet.size !== lessonOrders.length) {
    return NextResponse.json({ error: "Duplicate lesson ids" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("lessons")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("syllabus_id", syllabusId)
    .in("id", Array.from(idSet))

  if (existingError) {
    return NextResponse.json({ error: "Failed to reorder lessons" }, { status: 500 })
  }

  if ((existing ?? []).length !== idSet.size) {
    return NextResponse.json({ error: "One or more lessons were not found" }, { status: 404 })
  }

  const updates = lessonOrders.map((item) =>
    supabase
      .from("lessons")
      .update({ order: item.order })
      .eq("tenant_id", tenantId)
      .eq("syllabus_id", syllabusId)
      .eq("id", item.id)
  )

  const results = await Promise.all(updates)
  if (results.some((result) => result.error)) {
    return NextResponse.json({ error: "Failed to reorder lessons" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}

