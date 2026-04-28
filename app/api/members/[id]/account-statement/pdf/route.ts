import { pdf } from "@react-pdf/renderer"
import type { DocumentProps } from "@react-pdf/renderer"
import * as React from "react"
import { NextRequest } from "next/server"
import { z } from "zod"

import MemberAccountStatementPDF from "@/components/members/member-account-statement-pdf"
import { getTenantScopedRouteContext, NO_STORE_HEADERS, noStoreJson } from "@/lib/api/tenant-route"
import { isStaffRole } from "@/lib/auth/roles"
import { fetchMemberAccountStatementReport } from "@/lib/account-statement/fetch-member-account-statement-report"
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

  const reportResult = await fetchMemberAccountStatementReport(supabase, {
    tenantId,
    memberUserId: targetUserId,
    fromDate: parsed.data.from_date,
    toDate: parsed.data.to_date,
  })

  if (!reportResult.ok) {
    if (reportResult.error === "not_found") {
      return noStoreJson({ error: "Member profile not found" }, { status: 404 })
    }

    return noStoreJson({ error: "Failed to prepare account statement" }, { status: 500 })
  }

  const report = reportResult.data

  try {
    const pdfDocument = React.createElement(MemberAccountStatementPDF, {
      tenantName: report.tenant.name,
      logoUrl: report.tenant.logoUrl,
      memberName: report.member.name,
      memberEmail: report.member.email,
      dateRangeLabel: report.dateRangeLabel,
      generatedAtLabel: report.generatedAtLabel,
      rows: report.rows,
      closingBalanceLabel: report.closingBalanceLabel,
      closingBalanceTone: report.closingBalanceTone,
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
    logError("[account-statement] Failed to render account statement PDF", {
      error,
      tenantId,
      memberUserId: targetUserId,
    })
    return noStoreJson({ error: "Failed to render account statement PDF" }, { status: 500 })
  }
}
