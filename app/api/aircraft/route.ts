import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getAuthSession } from "@/lib/auth/session"
import { fetchAircraft } from "@/lib/aircraft/fetch-aircraft"

const querySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  aircraft_type_id: z.string().optional(),
})

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const rawQuery = Object.fromEntries(url.searchParams.entries())
  const parsedQuery = querySchema.safeParse(rawQuery)

  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Forbidden: Missing tenant context" },
      { status: 403 }
    )
  }

  try {
    const aircraft = await fetchAircraft(supabase, tenantId, parsedQuery.data)
    return NextResponse.json(
      { aircraft },
      { headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch aircraft" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
