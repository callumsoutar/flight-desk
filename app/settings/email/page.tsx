import { redirect } from "next/navigation"

import { EmailTriggerSettingsClient } from "@/components/settings/email-trigger-settings-client"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { getAuthSession } from "@/lib/auth/session"
import { EMAIL_TRIGGER_DESCRIPTIONS, EMAIL_TRIGGER_LABELS, EMAIL_TRIGGER_KEYS } from "@/lib/email/trigger-keys"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type TriggerConfigRow = {
  trigger_key: string
  is_enabled: boolean
  from_name: string | null
  reply_to: string | null
  subject_template: string | null
  cc_emails: string[] | null
  notify_instructor: boolean
}

async function EmailSettingsContent() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) redirect("/login")
  if (!tenantId) {
    return (
      <RouteNotFoundState
        heading="Account not set up"
        message="Your account has not been fully configured yet."
      />
    )
  }
  if (role !== "owner" && role !== "admin") {
    return (
      <RouteNotFoundState
        heading="Access denied"
        message="Only owners and admins can manage email trigger settings."
      />
    )
  }

  const { data } = await supabase
    .from("email_trigger_configs")
    .select(
      "trigger_key, is_enabled, from_name, reply_to, subject_template, cc_emails, notify_instructor"
    )
    .eq("tenant_id", tenantId)

  const initialConfigs = Object.fromEntries(
    (data ?? []).map((row: TriggerConfigRow) => [
      row.trigger_key,
      {
        is_enabled: row.is_enabled,
        from_name: row.from_name,
        reply_to: row.reply_to,
        subject_template: row.subject_template,
        cc_emails: row.cc_emails ?? [],
        notify_instructor: row.notify_instructor,
      },
    ])
  )

  const triggerOrder = Object.values(EMAIL_TRIGGER_KEYS)
  const triggerMeta = triggerOrder.map((triggerKey) => ({
    triggerKey,
    label: EMAIL_TRIGGER_LABELS[triggerKey],
    description: EMAIL_TRIGGER_DESCRIPTIONS[triggerKey],
  }))

  return <EmailTriggerSettingsClient triggerMeta={triggerMeta} initialConfigs={initialConfigs} />
}

export default async function EmailSettingsPage() {
  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <EmailSettingsContent />
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
