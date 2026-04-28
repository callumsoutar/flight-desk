import { render } from "@react-email/render"
import { pdf } from "@react-pdf/renderer"
import type { DocumentProps } from "@react-pdf/renderer"
import * as React from "react"
import { NextResponse } from "next/server"
import { z } from "zod"

import MemberFlightHistorySummaryPDF from "@/components/members/member-flight-history-summary-pdf"
import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { getPublicAppUrl } from "@/lib/env/public-app-url"
import { getTriggerConfig } from "@/lib/email/get-trigger-config"
import { interpolateSubject } from "@/lib/email/interpolate-subject"
import { sendEmail } from "@/lib/email/send-email"
import { FlightHistorySummaryEmail } from "@/lib/email/templates/flight-history-summary"
import { EMAIL_TRIGGER_KEYS } from "@/lib/email/trigger-keys"
import { fetchMemberFlightHistorySummaryReport } from "@/lib/flight-history/fetch-member-flight-history-summary"
import { logError } from "@/lib/security/logger"
import { enforceRateLimit } from "@/lib/security/rate-limit"

export const dynamic = "force-dynamic"

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/
const dateOnlySchema = z.string().regex(dateOnlyPattern, "Expected YYYY-MM-DD")

const payloadSchema = z
  .strictObject({
    user_id: z.string().uuid(),
    from_date: dateOnlySchema,
    to_date: dateOnlySchema,
  })
  .superRefine((value, ctx) => {
    if (value.from_date > value.to_date) {
      ctx.addIssue({
        code: "custom",
        message: "from_date cannot be after to_date",
        path: ["from_date"],
      })
    }
  })

export async function POST(request: Request) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, user, tenantId } = session.context

  const rateLimitResult = enforceRateLimit({
    key: `email:send-flight-history-summary:${tenantId}:${user.id}`,
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

  const reportResult = await fetchMemberFlightHistorySummaryReport(supabase, {
    tenantId,
    memberUserId,
    fromDate,
    toDate,
  })

  if (!reportResult.ok) {
    if (reportResult.error === "not_found") {
      return noStoreJson({ error: "Member profile not found" }, { status: 404 })
    }

    return noStoreJson({ error: "Failed to prepare flight history summary" }, { status: 500 })
  }

  const report = reportResult.data
  if (!report.member.email) {
    return noStoreJson({ error: "Member email is not available for this summary" }, { status: 422 })
  }

  const triggerConfig = await getTriggerConfig(
    supabase,
    tenantId,
    EMAIL_TRIGGER_KEYS.FLIGHT_HISTORY_SUMMARY_SEND
  )
  if (!triggerConfig.is_enabled) {
    return NextResponse.json(
      { error: "Flight history summary email trigger is disabled" },
      { status: 409, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const pdfDocument = React.createElement(MemberFlightHistorySummaryPDF, {
      tenantName: report.tenant.name,
      logoUrl: report.tenant.logoUrl,
      memberName: report.member.name,
      memberEmail: report.member.email,
      dateRangeLabel: report.dateRangeLabel,
      generatedAtLabel: report.generatedAtLabel,
      totalFlights: report.totalFlights,
      totalFlightHoursLabel: report.totalFlightHoursLabel,
      avgHoursPerFlightLabel: report.avgHoursPerFlightLabel,
      rows: report.rows,
    })

    const pdfBlob = await pdf(pdfDocument as unknown as React.ReactElement<DocumentProps>).toBlob()
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    const portalUrl = (() => {
      const appUrl = getPublicAppUrl()
      if (!appUrl) return null
      try {
        const url = new URL(`/members/${report.member.id}`, appUrl)
        url.searchParams.set("tab", "logbook")
        return url.toString()
      } catch {
        return null
      }
    })()

    const html = await render(
      FlightHistorySummaryEmail({
        tenantName: report.tenant.name,
        logoUrl: report.tenant.logoUrl,
        memberFirstName: report.member.firstName,
        memberName: report.member.name,
        dateRangeLabel: report.dateRangeLabel,
        totalFlights: report.totalFlights,
        totalFlightHoursLabel: report.totalFlightHoursLabel,
        avgHoursPerFlightLabel: report.avgHoursPerFlightLabel,
        portalUrl,
        contactEmail: report.tenant.contactEmail,
      })
    )

    const subject = triggerConfig.subject_template
      ? interpolateSubject(triggerConfig.subject_template, {
          tenantName: report.tenant.name,
          memberFirstName: report.member.firstName,
          memberLastName: report.member.lastName || undefined,
        })
      : `Flight history summary - ${report.member.name}`

    const result = await sendEmail({
      supabase,
      tenantId,
      triggerKey: EMAIL_TRIGGER_KEYS.FLIGHT_HISTORY_SUMMARY_SEND,
      to: report.member.email,
      subject,
      html,
      userId: memberUserId,
      triggeredBy: user.id,
      fromName: triggerConfig.from_name ?? report.tenant.name,
      replyTo: triggerConfig.reply_to ?? report.tenant.contactEmail ?? undefined,
      cc: triggerConfig.cc_emails,
      attachments: [
        {
          filename: report.pdfFilename,
          content: pdfBuffer,
          content_type: "application/pdf",
        },
      ],
      metadata: {
        source: "manual_send_flight_history_summary",
        from_date: fromDate,
        to_date: toDate,
        flight_count: report.totalFlights,
      },
    })

    if (!result.ok) {
      return noStoreJson({ error: "Failed to send flight history summary email" }, { status: 500 })
    }

    return noStoreJson({ ok: true, messageId: result.messageId })
  } catch (error) {
    logError("[email] Failed to render or send flight history summary email", {
      error,
      tenantId,
      memberUserId,
    })
    return noStoreJson({ error: "Failed to send flight history summary email" }, { status: 500 })
  }
}
