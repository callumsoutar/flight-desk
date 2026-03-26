import { NextRequest } from "next/server"
import { z } from "zod"

import { fetchAircraftTechLog } from "@/lib/aircraft/fetch-aircraft-tech-log"
import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

const querySchema = z.strictObject({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const parsed = querySchema.safeParse({
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  })

  if (!parsed.success) {
    return noStoreJson({ error: "Invalid query parameters" }, { status: 400 })
  }

  try {
    const payload = await fetchAircraftTechLog(supabase, {
      aircraftId: id,
      tenantId,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    })

    return noStoreJson(payload)
  } catch {
    return noStoreJson({ error: "Failed to load aircraft tech log" }, { status: 500 })
  }
}
