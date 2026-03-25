import { NextResponse } from "next/server"
import { render } from "@react-email/render"
import { z } from "zod"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { getTriggerConfig } from "@/lib/email/get-trigger-config"
import { interpolateSubject } from "@/lib/email/interpolate-subject"
import { sendEmail } from "@/lib/email/send-email"
import { AccountStatementEmail } from "@/lib/email/templates/account-statement"
import { EMAIL_TRIGGER_KEYS } from "@/lib/email/trigger-keys"
import { logError } from "@/lib/security/logger"
import { enforceRateLimit } from "@/lib/security/rate-limit"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const NO_STORE = { "cache-control": "no-store" } as const

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/
const dateOnlySchema = z.string().regex(dateOnlyPattern, "Expected YYYY-MM-DD")

const payloadSchema = z.strictObject({
  user_id: z.string().uuid(),
  from_date: dateOnlySchema.optional(),
  to_date: dateOnlySchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.from_date && value.to_date && value.from_date > value.to_date) {
    ctx.addIssue({
      code: "custom",
      message: "from_date cannot be after to_date",
      path: ["from_date"],
    })
  }
})

function toUtcStartOfDay(dateValue: string) {
  return `${dateValue}T00:00:00.000Z`
}

function toUtcEndOfDay(dateValue: string) {
  return `${dateValue}T23:59:59.999Z`
}

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

  const rateLimitResult = enforceRateLimit({
    key: `email:send-statement:${tenantId}:${user.id}`,
    limit: 20,
    windowMs: 60_000,
  })
  if (!rateLimitResult.ok) {
    return NextResponse.json(
      { error: "Too many email requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          ...NO_STORE,
          "retry-after": String(rateLimitResult.retryAfterSeconds),
        },
      }
    )
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
  }

  const { user_id: memberUserId, from_date: fromDate, to_date: toDate } = parsed.data

  const invoicesQuery = supabase
    .from("invoices")
    .select("id, invoice_number, issue_date, reference, total_amount, status")
    .eq("tenant_id", tenantId)
    .eq("user_id", memberUserId)
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })

  if (fromDate) invoicesQuery.gte("issue_date", fromDate)
  if (toDate) invoicesQuery.lte("issue_date", toDate)

  const creditsQuery = supabase
    .from("transactions")
    .select("id, amount")
    .eq("tenant_id", tenantId)
    .eq("user_id", memberUserId)
    .eq("status", "completed")
    .eq("type", "credit")
    .contains("metadata", { transaction_type: "member_credit_topup" })

  if (fromDate) creditsQuery.gte("completed_at", toUtcStartOfDay(fromDate))
  if (toDate) creditsQuery.lte("completed_at", toUtcEndOfDay(toDate))

  const [{ data: invoices }, { data: credits }, { data: memberTenant }, { data: tenant }] = await Promise.all([
    invoicesQuery,
    creditsQuery,
    supabase
      .from("tenant_users")
      .select("user:user_directory!tenant_users_user_id_fkey(id, first_name, last_name, email)")
      .eq("tenant_id", tenantId)
      .eq("user_id", memberUserId)
      .maybeSingle(),
    supabase
      .from("tenants")
      .select("name, logo_url, contact_email, currency")
      .eq("id", tenantId)
      .maybeSingle(),
  ])

  const member =
    (memberTenant?.user as
      | { id?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null }
      | null) ?? null
  if (!member?.email) {
    return NextResponse.json({ error: "Member profile not found" }, { status: 404, headers: NO_STORE })
  }

  const invoiceIds = (invoices ?? []).map((invoice) => invoice.id)
  const { data: payments } = invoiceIds.length
    ? await supabase
        .from("invoice_payments")
        .select("invoice_id, amount")
        .eq("tenant_id", tenantId)
        .in("invoice_id", invoiceIds)
    : { data: [] as Array<{ invoice_id: string; amount: number }> }

  const paidByInvoice = new Map<string, number>()
  for (const payment of payments ?? []) {
    paidByInvoice.set(payment.invoice_id, (paidByInvoice.get(payment.invoice_id) ?? 0) + payment.amount)
  }

  const periodCreditsTotal = (credits ?? []).reduce((total, credit) => total + (credit.amount ?? 0), 0)

  let openingBalance = 0
  if (fromDate) {
    const { data: previousInvoices } = await supabase
      .from("invoices")
      .select("id, total_amount")
      .eq("tenant_id", tenantId)
      .eq("user_id", memberUserId)
      .is("deleted_at", null)
      .lt("issue_date", fromDate)

    const previousInvoiceIds = (previousInvoices ?? []).map((invoice) => invoice.id)
    const { data: previousPayments } = previousInvoiceIds.length
      ? await supabase
          .from("invoice_payments")
          .select("invoice_id, amount")
          .eq("tenant_id", tenantId)
          .in("invoice_id", previousInvoiceIds)
      : { data: [] as Array<{ invoice_id: string; amount: number }> }

    const { data: previousCredits } = await supabase
      .from("transactions")
      .select("id, amount")
      .eq("tenant_id", tenantId)
      .eq("user_id", memberUserId)
      .eq("status", "completed")
      .eq("type", "credit")
      .contains("metadata", { transaction_type: "member_credit_topup" })
      .lt("completed_at", toUtcStartOfDay(fromDate))

    const previousPaidByInvoice = new Map<string, number>()
    for (const payment of previousPayments ?? []) {
      previousPaidByInvoice.set(
        payment.invoice_id,
        (previousPaidByInvoice.get(payment.invoice_id) ?? 0) + payment.amount
      )
    }

    const openingInvoiceBalance = (previousInvoices ?? []).reduce((total, invoice) => {
      const paid = previousPaidByInvoice.get(invoice.id) ?? 0
      return total + (invoice.total_amount ?? 0) - paid
    }, 0)

    const openingCreditsTotal = (previousCredits ?? []).reduce(
      (total, credit) => total + (credit.amount ?? 0),
      0
    )

    openingBalance = openingInvoiceBalance - openingCreditsTotal
  }

  const statementInvoices = (invoices ?? []).map((invoice) => {
    const paid = paidByInvoice.get(invoice.id) ?? 0
    const amount = invoice.total_amount ?? 0
    const balance = amount - paid

    return {
      invoiceNumber: invoice.invoice_number ?? "Draft",
      date: invoice.issue_date,
      description: invoice.reference ?? "Invoice",
      amount,
      paid,
      balance,
      status: invoice.status,
    }
  })

  const totalOutstanding = statementInvoices.reduce((sum, invoice) => sum + invoice.balance, 0) - periodCreditsTotal

  const triggerConfig = await getTriggerConfig(supabase, tenantId, EMAIL_TRIGGER_KEYS.STATEMENT_SEND)
  if (!triggerConfig.is_enabled) {
    return NextResponse.json(
      { error: "Statement email trigger is disabled" },
      { status: 409, headers: NO_STORE }
    )
  }

  try {
    const statementDate = new Intl.DateTimeFormat("en-NZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date())
    const statementUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invoices`
    const html = await render(
      AccountStatementEmail({
        tenantName: tenant?.name ?? "Your Aero Club",
        logoUrl: tenant?.logo_url,
        memberFirstName: member.first_name ?? "there",
        memberEmail: member.email,
        statementDate,
        currency: tenant?.currency ?? "NZD",
        openingBalance,
        invoices: statementInvoices,
        totalOutstanding,
        statementUrl,
        contactEmail: tenant?.contact_email,
      })
    )

    const subject = triggerConfig.subject_template
      ? interpolateSubject(triggerConfig.subject_template, {
          tenantName: tenant?.name ?? undefined,
          memberFirstName: member.first_name ?? undefined,
          memberLastName: member.last_name ?? undefined,
        })
      : `Account Statement - ${tenant?.name ?? "Flight Desk"}`

    const result = await sendEmail({
      supabase,
      tenantId,
      triggerKey: EMAIL_TRIGGER_KEYS.STATEMENT_SEND,
      to: member.email,
      subject,
      html,
      userId: memberUserId,
      triggeredBy: user.id,
      fromName: triggerConfig.from_name ?? tenant?.name ?? undefined,
      replyTo: triggerConfig.reply_to ?? tenant?.contact_email ?? undefined,
      cc: triggerConfig.cc_emails,
      metadata: {
        source: "manual_send_statement",
        from_date: fromDate ?? null,
        to_date: toDate ?? null,
      },
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: "Failed to send statement email" },
        { status: 500, headers: NO_STORE }
      )
    }

    return NextResponse.json({ ok: true, messageId: result.messageId }, { headers: NO_STORE })
  } catch (error) {
    logError("[email] Failed to render or send statement email", { error, tenantId })
    return NextResponse.json({ error: "Failed to send statement email" }, { status: 500, headers: NO_STORE })
  }
}
