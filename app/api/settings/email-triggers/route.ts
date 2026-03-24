import { NextResponse } from "next/server"
import { z } from "zod"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { EMAIL_TRIGGER_KEYS } from "@/lib/email/trigger-keys"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const NO_STORE = { "cache-control": "no-store" } as const

const triggerValues = Object.values(EMAIL_TRIGGER_KEYS)

const payloadSchema = z.object({
  trigger_key: z.enum(triggerValues as [string, ...string[]]),
  is_enabled: z.boolean(),
  from_name: z.string().trim().max(200).nullable().optional(),
  reply_to: z.email().nullable().optional(),
  subject_template: z.string().trim().max(300).nullable().optional(),
  cc_emails: z.array(z.email()).optional(),
  notify_instructor: z.boolean().optional(),
})

export async function PATCH(request: Request) {
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

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
  }

  const payload = parsed.data
  const ccEmails = payload.cc_emails?.map((value) => value.trim()).filter(Boolean) ?? []

  const { error } = await supabase.from("email_trigger_configs").upsert(
    {
      tenant_id: tenantId,
      trigger_key: payload.trigger_key,
      is_enabled: payload.is_enabled,
      from_name: payload.from_name ?? null,
      reply_to: payload.reply_to ?? null,
      subject_template: payload.subject_template ?? null,
      cc_emails: ccEmails,
      notify_instructor: payload.notify_instructor ?? false,
    },
    { onConflict: "tenant_id,trigger_key" }
  )

  if (error) {
    return NextResponse.json({ error: "Failed to save email trigger settings" }, { status: 500, headers: NO_STORE })
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
