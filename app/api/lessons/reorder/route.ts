import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const payloadSchema = z.strictObject({
  syllabus_id: z.string().uuid(),
  lesson_orders: z.array(z.strictObject({ id: z.string().uuid(), order: z.number().int().min(1).max(10000) })).min(1),
})

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const ctx = await getTenantAdminRouteContext(supabase)
  if (ctx.response) return ctx.response
  const { tenantId } = ctx.context

  const raw = await request.json().catch(() => null)
  const parsed = payloadSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const { syllabus_id: syllabusId, lesson_orders: lessonOrders } = parsed.data

  const idSet = new Set(lessonOrders.map((item) => item.id))
  if (idSet.size !== lessonOrders.length) {
    return noStoreJson({ error: "Duplicate lesson ids" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("lessons")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("syllabus_id", syllabusId)
    .in("id", Array.from(idSet))

  if (existingError) {
    return noStoreJson({ error: "Failed to reorder lessons" }, { status: 500 })
  }

  if ((existing ?? []).length !== idSet.size) {
    return noStoreJson({ error: "One or more lessons were not found" }, { status: 404 })
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
    return noStoreJson({ error: "Failed to reorder lessons" }, { status: 500 })
  }

  return noStoreJson({ ok: true })
}
