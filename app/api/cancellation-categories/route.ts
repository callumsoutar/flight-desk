import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type CancellationCategory = {
  id: string
  name: string
  description: string | null
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

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

  const [globalResult, tenantResult] = await Promise.all([
    supabase
      .from("cancellation_categories")
      .select("id, name, description")
      .eq("is_global", true)
      .is("voided_at", null),
    supabase
      .from("cancellation_categories")
      .select("id, name, description")
      .eq("tenant_id", tenantId)
      .is("voided_at", null),
  ])

  if (globalResult.error || tenantResult.error) {
    return NextResponse.json(
      { error: "Failed to load cancellation categories" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  const byId = new Map<string, CancellationCategory>()
  for (const category of globalResult.data ?? []) {
    byId.set(category.id, {
      id: category.id,
      name: category.name,
      description: category.description,
    })
  }
  for (const category of tenantResult.data ?? []) {
    byId.set(category.id, {
      id: category.id,
      name: category.name,
      description: category.description,
    })
  }

  const categories = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json(
    { categories },
    { headers: { "cache-control": "no-store" } }
  )
}
