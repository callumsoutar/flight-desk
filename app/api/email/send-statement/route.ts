import { render } from "@react-email/render"
import { NextResponse } from "next/server"
import { z } from "zod"

import { buildAccountStatement } from "@/lib/account-statement/build-account-statement"
import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { getPublicAppUrl } from "@/lib/env/public-app-url"
import { getTriggerConfig } from "@/lib/email/get-trigger-config"
import { interpolateSubject } from "@/lib/email/interpolate-subject"
import { sendEmail } from "@/lib/email/send-email"
import { AccountStatementEmail } from "@/lib/email/templates/account-statement"
import { EMAIL_TRIGGER_KEYS } from "@/lib/email/trigger-keys"
import { logError } from "@/lib/security/logger"
import { enforceRateLimit } from "@/lib/security/rate-limit"

export const dynamic = "force-dynamic"

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

function formatDateLabel(dateValue: string, timeZone = "Pacific/Auckland") {
  const date = new Date(`${dateValue}T00:00:00.000Z`)
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date)
}

export async function POST(request: Request) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, user, tenantId } = session.context

  const rateLimitResult = enforceRateLimit({
    key: `email:send-statement:${tenantId}:${user.id}`,
    limit: 20,
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

  const { user_id: memberUserId, from_date: fromDate, to_date: toDate } = parsed.data

  const [{ data: memberTenant }, { data: tenant }, statementResult] = await Promise.all([
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
    buildAccountStatement(supabase, {
      tenantId,
      targetUserId: memberUserId,
      startDate: fromDate ?? null,
      endDate: toDate ?? null,
    }),
  ])

  const member =
    (memberTenant?.user as
      | { id?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null }
      | null) ?? null
  if (!member?.email) {
    return noStoreJson({ error: "Member profile not found" }, { status: 404 })
  }

  if (!statementResult.ok) {
    if (statementResult.error === "not_found") {
      return noStoreJson({ error: "Member profile not found" }, { status: 404 })
    }

    return noStoreJson({ error: "Failed to prepare account statement" }, { status: 500 })
  }

  const triggerConfig = await getTriggerConfig(supabase, tenantId, EMAIL_TRIGGER_KEYS.STATEMENT_SEND)
  if (!triggerConfig.is_enabled) {
    return NextResponse.json(
      { error: "Statement email trigger is disabled" },
      { status: 409, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const timeZone = "Pacific/Auckland"
    const statementDate = new Intl.DateTimeFormat("en-NZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone,
    }).format(new Date())

    const statementPeriodLabel =
      fromDate && toDate
        ? `${formatDateLabel(fromDate, timeZone)} to ${formatDateLabel(toDate, timeZone)}`
        : "All transactions"

    const portalStatementUrl = (() => {
      const appUrl = getPublicAppUrl()
      if (!appUrl) return null
      try {
        const url = new URL("/invoices", appUrl)
        if (fromDate && toDate) {
          url.searchParams.set("start_date", fromDate)
          url.searchParams.set("end_date", toDate)
        }
        return url.toString()
      } catch {
        return null
      }
    })()

    const html = await render(
      AccountStatementEmail({
        tenantName: tenant?.name ?? "Your Aero Club",
        logoUrl: tenant?.logo_url,
        memberFirstName: member.first_name ?? "there",
        statementDate,
        statementPeriodLabel,
        currency: tenant?.currency ?? "NZD",
        statement: statementResult.data.statement,
        closingBalance: statementResult.data.closing_balance,
        statementUrl: portalStatementUrl,
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
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    return noStoreJson({ ok: true, messageId: result.messageId })
  } catch (error) {
    logError("[email] Failed to render or send statement email", { error, tenantId })
    return noStoreJson({ error: "Failed to send statement email" }, { status: 500 })
  }
}
