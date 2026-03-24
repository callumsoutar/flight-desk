import { NextResponse } from "next/server"
import { render } from "@react-email/render"
import { pdf } from "@react-pdf/renderer"
import type { DocumentProps } from "@react-pdf/renderer"
import * as React from "react"
import { z } from "zod"

import { isStaffRole } from "@/lib/auth/roles"
import InvoiceReportPDF from "@/components/invoices/invoice-report-pdf"
import { getAuthSession } from "@/lib/auth/session"
import { getTriggerConfig } from "@/lib/email/get-trigger-config"
import { interpolateSubject } from "@/lib/email/interpolate-subject"
import { sendEmail } from "@/lib/email/send-email"
import { InvoiceEmail } from "@/lib/email/templates/invoice-email"
import { EMAIL_TRIGGER_KEYS } from "@/lib/email/trigger-keys"
import { fetchInvoicingSettings } from "@/lib/invoices/fetch-invoicing-settings"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/utils/date-format"

export const dynamic = "force-dynamic"

const NO_STORE = { "cache-control": "no-store" } as const

const payloadSchema = z.object({
  invoice_id: z.string().uuid(),
})

export async function POST(request: Request) {
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
  if (!isStaffRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
  }

  const invoiceId = parsed.data.invoice_id
  const invoiceTimeZone = "Pacific/Auckland"

  const [{ data: invoice }, { data: items }, invoicingSettings] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, tenant_id, user_id, invoice_number, issue_date, due_date, tax_rate, subtotal, tax_total, total_amount, total_paid, balance_due, notes, user:user_directory!invoices_user_id_fkey(id, first_name, last_name, email), tenant:tenants!invoices_tenant_id_fkey(name, logo_url, contact_email, currency)"
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
    return NextResponse.json({ error: "Invoice not found" }, { status: 404, headers: NO_STORE })
  }

  const triggerConfig = await getTriggerConfig(supabase, tenantId, EMAIL_TRIGGER_KEYS.INVOICE_SEND)
  if (!triggerConfig.is_enabled) {
    return NextResponse.json(
      { error: "Invoice email trigger is disabled" },
      { status: 409, headers: NO_STORE }
    )
  }

  const member = (invoice.user as { first_name?: string | null; email?: string | null } | null) ?? null
  const tenant = (invoice.tenant as
    | { name?: string | null; logo_url?: string | null; contact_email?: string | null; currency?: string | null }
    | null) ?? null
  const memberEmail = member?.email ?? null

  if (!memberEmail) {
    return NextResponse.json(
      { error: "Member email is not available for this invoice" },
      { status: 422, headers: NO_STORE }
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
      return NextResponse.json({ error: result.error ?? "Failed to send email" }, { status: 500, headers: NO_STORE })
    }

    return NextResponse.json({ ok: true, messageId: result.messageId }, { headers: NO_STORE })
  } catch (error) {
    console.error("[email] Failed to render or send invoice email:", error)
    return NextResponse.json({ error: "Failed to send invoice email" }, { status: 500, headers: NO_STORE })
  }
}
