import { render } from "@react-email/render"
import { pdf } from "@react-pdf/renderer"
import type { DocumentProps } from "@react-pdf/renderer"
import { NextResponse } from "next/server"
import * as React from "react"
import { z } from "zod"

import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import InvoiceReportPDF from "@/components/invoices/invoice-report-pdf"
import { getTriggerConfig } from "@/lib/email/get-trigger-config"
import { interpolateSubject } from "@/lib/email/interpolate-subject"
import { sendEmail } from "@/lib/email/send-email"
import { InvoiceEmail } from "@/lib/email/templates/invoice-email"
import { EMAIL_TRIGGER_KEYS } from "@/lib/email/trigger-keys"
import { fetchInvoicingSettings } from "@/lib/invoices/fetch-invoicing-settings"
import { logError } from "@/lib/security/logger"
import { enforceRateLimit } from "@/lib/security/rate-limit"
import { formatDate } from "@/lib/utils/date-format"

export const dynamic = "force-dynamic"

const payloadSchema = z.strictObject({
  invoice_id: z.string().uuid(),
}).strict()

export async function POST(request: Request) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, user, tenantId } = session.context

  const rateLimitResult = enforceRateLimit({
    key: `email:send-invoice:${tenantId}:${user.id}`,
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimitResult.ok) {
    return noStoreJson(
      { error: "Too many email requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "retry-after": String(rateLimitResult.retryAfterSeconds),
        },
      }
    )
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const invoiceId = parsed.data.invoice_id

  const [{ data: invoice }, { data: items }, invoicingSettings] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, tenant_id, user_id, invoice_number, issue_date, due_date, tax_rate, subtotal, tax_total, total_amount, total_paid, balance_due, notes, user:user_directory!invoices_user_id_fkey(id, first_name, last_name, email), tenant:tenants!invoices_tenant_id_fkey(name, logo_url, contact_email, currency, timezone)"
      )
      .eq("tenant_id", tenantId)
      .eq("id", invoiceId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("invoice_items")
      .select("id, description, quantity, unit_price, rate_inclusive, line_total")
      .eq("tenant_id", tenantId)
      .eq("invoice_id", invoiceId)
      .is("deleted_at", null),
    fetchInvoicingSettings(supabase, tenantId),
  ])

  if (!invoice) {
    return noStoreJson({ error: "Invoice not found" }, { status: 404 })
  }

  const triggerConfig = await getTriggerConfig(supabase, tenantId, EMAIL_TRIGGER_KEYS.INVOICE_SEND)
  if (!triggerConfig.is_enabled) {
    return NextResponse.json(
      { error: "Invoice email trigger is disabled" },
      { status: 409, headers: { "cache-control": "no-store" } }
    )
  }

  const member = (invoice.user as { first_name?: string | null; email?: string | null } | null) ?? null
  const tenant = (invoice.tenant as
    | { name?: string | null; logo_url?: string | null; contact_email?: string | null; currency?: string | null; timezone?: string | null }
    | null) ?? null
  const invoiceTimeZone = tenant?.timezone?.trim() || "Pacific/Auckland"
  const memberEmail = member?.email ?? null

  if (!memberEmail) {
    return NextResponse.json(
      { error: "Member email is not available for this invoice" },
      { status: 422, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const rawInvoiceNumber = invoice.invoice_number || `#${invoice.id.slice(0, 8)}`
    const safeInvoiceNumber = rawInvoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_")
    const billToName =
      `${member?.first_name ?? ""} ${(invoice.user as { last_name?: string | null } | null)?.last_name ?? ""}`.trim() ||
      memberEmail

    const invoicePdfDocument = React.createElement(InvoiceReportPDF, {
      settings: invoicingSettings,
      invoice: {
        invoiceNumber: rawInvoiceNumber,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        taxRate: invoice.tax_rate ?? 0,
        subtotal: invoice.subtotal ?? 0,
        taxTotal: invoice.tax_total ?? 0,
        totalAmount: invoice.total_amount ?? 0,
        totalPaid: invoice.total_paid ?? 0,
        balanceDue: invoice.balance_due ?? Math.max(0, (invoice.total_amount ?? 0) - (invoice.total_paid ?? 0)),
        billToName,
      },
      items: (items ?? []).map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        rate_inclusive: item.rate_inclusive,
        line_total: item.line_total,
      })),
      timeZone: invoiceTimeZone,
    })

    const invoicePdfBlob = await pdf(
      invoicePdfDocument as unknown as React.ReactElement<DocumentProps>
    ).toBlob()
    const invoicePdfBuffer = Buffer.from(await invoicePdfBlob.arrayBuffer())

    const html = await render(
      InvoiceEmail({
        tenantName: tenant?.name ?? "Your Aero Club",
        logoUrl: tenant?.logo_url,
        memberFirstName: member?.first_name ?? "there",
        invoiceNumber: rawInvoiceNumber,
        invoiceDate: formatDate(invoice.issue_date, invoiceTimeZone, "medium") || "—",
        totalAmount: invoice.total_amount ?? 0,
        currency: tenant?.currency ?? "NZD",
        dueDate: formatDate(invoice.due_date, invoiceTimeZone, "medium") || null,
        contactEmail: tenant?.contact_email,
      })
    )

    const subject = triggerConfig.subject_template
      ? interpolateSubject(triggerConfig.subject_template, {
          tenantName: tenant?.name ?? undefined,
          memberFirstName: member?.first_name ?? undefined,
          memberLastName: (invoice.user as { last_name?: string | null } | null)?.last_name ?? undefined,
          invoiceNumber: invoice.invoice_number ?? undefined,
        })
      : `Invoice ${invoice.invoice_number ?? ""} from ${tenant?.name ?? "Flight Desk"}`

    const result = await sendEmail({
      supabase,
      tenantId,
      triggerKey: EMAIL_TRIGGER_KEYS.INVOICE_SEND,
      to: memberEmail,
      subject,
      html,
      invoiceId,
      userId: invoice.user_id,
      triggeredBy: user.id,
      fromName: triggerConfig.from_name ?? tenant?.name ?? undefined,
      replyTo: triggerConfig.reply_to ?? tenant?.contact_email ?? undefined,
      cc: triggerConfig.cc_emails,
      attachments: [
        {
          filename: `invoice-${safeInvoiceNumber}.pdf`,
          content: invoicePdfBuffer,
          content_type: "application/pdf",
        },
      ],
      metadata: { source: "manual_send_invoice" },
    })

    if (!result.ok) {
      return noStoreJson({ error: "Failed to send email" }, { status: 500 })
    }

    return noStoreJson({ ok: true, messageId: result.messageId })
  } catch (error) {
    logError("[email] Failed to render or send invoice email", { error, tenantId })
    return noStoreJson({ error: "Failed to send invoice email" }, { status: 500 })
  }
}
