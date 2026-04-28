import { pdf } from "@react-pdf/renderer"
import type { DocumentProps } from "@react-pdf/renderer"
import * as React from "react"
import { NextRequest } from "next/server"
import { z } from "zod"

import MemberFlightHistorySummaryPDF from "@/components/members/member-flight-history-summary-pdf"
import { getTenantScopedRouteContext, NO_STORE_HEADERS, noStoreJson } from "@/lib/api/tenant-route"
import { isStaffRole } from "@/lib/auth/roles"
import { fetchMemberFlightHistorySummaryReport } from "@/lib/flight-history/fetch-member-flight-history-summary"
import { logError } from "@/lib/security/logger"

export const dynamic = "force-dynamic"

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/
const dateOnlySchema = z.string().regex(dateOnlyPattern, "Expected YYYY-MM-DD")

const querySchema = z
  .strictObject({
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params

  const session = await getTenantScopedRouteContext({ includeRole: true })
  if (session.response) return session.response
  const { supabase, user, role, tenantId } = session.context

  const canViewOtherMembers = isStaffRole(role)
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = querySchema.safeParse({
    from_date: request.nextUrl.searchParams.get("from_date"),
    to_date: request.nextUrl.searchParams.get("to_date"),
  })
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid date range" }, { status: 400 })
  }

  const reportResult = await fetchMemberFlightHistorySummaryReport(supabase, {
    tenantId,
    memberUserId: targetUserId,
    fromDate: parsed.data.from_date,
    toDate: parsed.data.to_date,
  })

  if (!reportResult.ok) {
    if (reportResult.error === "not_found") {
      return noStoreJson({ error: "Member profile not found" }, { status: 404 })
    }

    return noStoreJson({ error: "Failed to prepare flight history summary" }, { status: 500 })
  }

  const report = reportResult.data

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

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${report.pdfFilename}"`,
      },
    })
  } catch (error) {
    logError("[flight-history] Failed to render summary PDF", {
      error,
      tenantId,
      memberUserId: targetUserId,
    })
    return noStoreJson({ error: "Failed to render flight history summary PDF" }, { status: 500 })
  }
}
