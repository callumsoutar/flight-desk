import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged"
import { upsertXeroAccount } from "@/lib/xero/upsert-account"

export const dynamic = "force-dynamic"

const bodySchema = z.strictObject({
  xero_account_id: z.string().min(1),
  code: z.string().nullable(),
  name: z.string().min(1),
  type: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  class: z.string().nullable().optional(),
})

export async function POST(request: NextRequest) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { tenantId } = session.context

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const { xero_account_id, code, name, type, status, class: cls } = parsed.data

  try {
    const admin = createPrivilegedSupabaseClient("cache Xero chart-of-accounts records for a tenant")
    await upsertXeroAccount(admin, tenantId, {
      AccountID: xero_account_id,
      Code: code,
      Name: name,
      Type: type ?? null,
      Status: status ?? "ACTIVE",
      Class: cls ?? null,
    })

    return noStoreJson({ ok: true })
  } catch {
    return noStoreJson(
      { error: "Failed to cache account" },
      { status: 500 }
    )
  }
}
