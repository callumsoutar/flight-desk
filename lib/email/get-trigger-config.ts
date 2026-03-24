import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"

import type { EmailTriggerKey } from "./trigger-keys"

export type TriggerConfig = {
  is_enabled: boolean
  from_name: string | null
  reply_to: string | null
  subject_template: string | null
  cc_emails: string[]
  notify_instructor: boolean
}

export async function getTriggerConfig(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  triggerKey: EmailTriggerKey
): Promise<TriggerConfig> {
  const { data } = await supabase
    .from("email_trigger_configs")
    .select("is_enabled, from_name, reply_to, subject_template, cc_emails, notify_instructor")
    .eq("tenant_id", tenantId)
    .eq("trigger_key", triggerKey)
    .maybeSingle()

  return {
    is_enabled: data?.is_enabled ?? true,
    from_name: data?.from_name ?? null,
    reply_to: data?.reply_to ?? null,
    subject_template: data?.subject_template ?? null,
    cc_emails: data?.cc_emails ?? [],
    notify_instructor: data?.notify_instructor ?? false,
  }
}
