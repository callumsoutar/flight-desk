import type { SupabaseClient } from "@supabase/supabase-js"

import { logError } from "@/lib/security/logger"
import type { Database } from "@/lib/types"

import { getResendClient } from "./resend-client"
import type { EmailTriggerKey } from "./trigger-keys"

function getFromEmail() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim()
  if (configured) return configured
  if (process.env.NODE_ENV === "production") {
    throw new Error("RESEND_FROM_EMAIL environment variable is not set")
  }
  return "noreply@flightdesk.app"
}

export type SendEmailOptions = {
  supabase: SupabaseClient<Database>
  tenantId: string
  triggerKey: EmailTriggerKey
  to: string | string[]
  subject: string
  html: string
  bookingId?: string
  invoiceId?: string
  userId?: string
  triggeredBy?: string
  fromName?: string | null
  replyTo?: string | null
  cc?: string[]
  attachments?: Array<{
    filename: string
    content: string | Buffer
    content_type?: string
  }>
  metadata?: Record<string, unknown>
}

export type SendEmailResult = {
  ok: boolean
  messageId?: string
  error?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const {
    supabase,
    tenantId,
    triggerKey,
    to,
    subject,
    html,
    bookingId,
    invoiceId,
    userId,
    triggeredBy,
    fromName,
    replyTo,
    cc,
    attachments,
    metadata,
  } = opts

  const fromEmail = getFromEmail()
  const fromAddress = fromName ? `${fromName} <${fromEmail}>` : `Flight Desk <${fromEmail}>`
  const recipients = Array.isArray(to) ? to : [to]

  let messageId: string | undefined
  let sendError: string | undefined

  try {
    const resend = getResendClient()
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: recipients,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
      ...(cc && cc.length > 0 ? { cc } : {}),
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    })

    if (error) {
      sendError = error.message
    } else {
      messageId = data?.id
    }
  } catch (error) {
    sendError = error instanceof Error ? error.message : "Unknown send error"
  }

  const logRow: Database["public"]["Tables"]["email_logs"]["Insert"] = {
    tenant_id: tenantId,
    email_type: triggerKey,
    recipient_email: recipients.join(", "),
    subject,
    message_id: messageId ?? null,
    status: sendError ? "failed" : "sent",
    error_message: sendError ?? null,
    sent_at: new Date().toISOString(),
    booking_id: bookingId ?? null,
    invoice_id: invoiceId ?? null,
    user_id: userId ?? null,
    triggered_by: triggeredBy ?? null,
    metadata: (metadata ?? {}) as Database["public"]["Tables"]["email_logs"]["Insert"]["metadata"],
  }

  await supabase.from("email_logs").insert(logRow)

  if (sendError) {
    logError(`[email] Failed to send ${triggerKey}`, {
      error: sendError,
      triggerKey,
      tenantId,
    })
    return { ok: false, error: "Failed to send email" }
  }

  return { ok: true, messageId }
}
