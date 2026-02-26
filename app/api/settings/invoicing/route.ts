import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { fetchInvoicingSettings } from "@/lib/invoices/fetch-invoicing-settings"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, {
    includeTenant: true,
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

  try {
    const settings = await fetchInvoicingSettings(supabase, tenantId)
    return NextResponse.json(
      { settings },
      { headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to load invoicing settings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
