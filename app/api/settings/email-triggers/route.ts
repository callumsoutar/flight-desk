import { z } from "zod"

import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { EMAIL_TRIGGER_KEYS } from "@/lib/email/trigger-keys"

export const dynamic = "force-dynamic"

const triggerValues = Object.values(EMAIL_TRIGGER_KEYS)

const payloadSchema = z.strictObject({
  trigger_key: z.enum(triggerValues as [string, ...string[]]),
  is_enabled: z.boolean(),
  from_name: z.string().trim().max(200).nullable().optional(),
  reply_to: z.email().nullable().optional(),
  subject_template: z.string().trim().max(300).nullable().optional(),
  cc_emails: z.array(z.email()).optional(),
  notify_instructor: z.boolean().optional(),
})

export async function PATCH(request: Request) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
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
    return noStoreJson({ error: "Failed to save email trigger settings" }, { status: 500 })
  }

  return noStoreJson({ ok: true })
}
