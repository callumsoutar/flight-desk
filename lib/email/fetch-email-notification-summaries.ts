import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { logError } from "@/lib/security/logger"
import type { Database } from "@/lib/types"

import type { BookingEmailNotificationSummary, InvoiceEmailNotificationSummary } from "./email-notification-summary-types"
import { EMAIL_TRIGGER_KEYS } from "./trigger-keys"

export type { BookingEmailNotificationSummary, InvoiceEmailNotificationSummary } from "./email-notification-summary-types"

export async function fetchBookingEmailNotificationSummary(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  bookingId: string
): Promise<BookingEmailNotificationSummary> {
  const { data, error } = await supabase
    .from("email_logs")
    .select("sent_at")
    .eq("tenant_id", tenantId)
    .eq("booking_id", bookingId)
    .eq("email_type", EMAIL_TRIGGER_KEYS.BOOKING_CONFIRMED)
    .eq("status", "sent")
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logError("[email] fetchBookingEmailNotificationSummary", { error, tenantId, bookingId })
    return { confirmationSentAt: null }
  }

  const sentAt = data?.sent_at
  return {
    confirmationSentAt: typeof sentAt === "string" ? sentAt : null,
  }
}

export async function fetchInvoiceEmailNotificationSummary(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  invoiceId: string
): Promise<InvoiceEmailNotificationSummary> {
  const { data, error } = await supabase
    .from("email_logs")
    .select("sent_at")
    .eq("tenant_id", tenantId)
    .eq("invoice_id", invoiceId)
    .eq("email_type", EMAIL_TRIGGER_KEYS.INVOICE_SEND)
    .eq("status", "sent")
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logError("[email] fetchInvoiceEmailNotificationSummary", { error, tenantId, invoiceId })
    return { invoiceSentAt: null }
  }

  const sentAt = data?.sent_at
  return {
    invoiceSentAt: typeof sentAt === "string" ? sentAt : null,
  }
}
