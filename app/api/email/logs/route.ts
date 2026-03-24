import { NextRequest, NextResponse } from "next/server"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const NO_STORE = { "cache-control": "no-store" } as const

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })
  if (!tenantId) {
    return NextResponse.json({ error: "Account not configured" }, { status: 400, headers: NO_STORE })
  }
  if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })

  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1)
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10) || 50)
  )
  const triggerKey = request.nextUrl.searchParams.get("trigger_key")
  const status = request.nextUrl.searchParams.get("status")
  const dateFrom = request.nextUrl.searchParams.get("date_from")
  const dateTo = request.nextUrl.searchParams.get("date_to")
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from("email_logs")
    .select("id, sent_at, email_type, recipient_email, subject, status, booking_id, invoice_id", {
      count: "exact",
    })
    .eq("tenant_id", tenantId)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .range(from, to)

  if (triggerKey) query = query.eq("email_type", triggerKey)
  if (status) query = query.eq("status", status)
  if (dateFrom) query = query.gte("sent_at", dateFrom)
  if (dateTo) query = query.lte("sent_at", dateTo)

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: "Failed to load email logs" }, { status: 500, headers: NO_STORE })
  }

  return NextResponse.json(
    {
      logs: data ?? [],
      total: count ?? 0,
      page,
      limit,
    },
    { headers: NO_STORE }
  )
}
