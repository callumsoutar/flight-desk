import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { upsertXeroAccount } from "@/lib/xero/upsert-account"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  xero_account_id: z.string().min(1),
  code: z.string().nullable(),
  name: z.string().min(1),
  type: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  class: z.string().nullable().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    includeTenant: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  if (!isStaffRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { xero_account_id, code, name, type, status, class: cls } = parsed.data

  try {
    const admin = createSupabaseAdminClient()
    await upsertXeroAccount(admin, tenantId, {
      AccountID: xero_account_id,
      Code: code,
      Name: name,
      Type: type ?? null,
      Status: status ?? "ACTIVE",
      Class: cls ?? null,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: "Failed to cache account" },
      { status: 500 }
    )
  }
}
