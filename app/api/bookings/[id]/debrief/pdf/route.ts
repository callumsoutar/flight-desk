import { pdf } from "@react-pdf/renderer"
import type { DocumentProps } from "@react-pdf/renderer"
import * as React from "react"

import DebriefReportPDF from "@/components/debrief/debrief-report-pdf"
import { getTenantStaffRouteContext, NO_STORE_HEADERS, noStoreJson } from "@/lib/api/tenant-route"
import {
  buildDebriefPdfFilename,
  buildDebriefReportPdfProps,
} from "@/lib/debrief/build-debrief-report-pdf"
import { fetchDebriefData } from "@/lib/debrief/fetch-debrief-data"
import { logError } from "@/lib/security/logger"

export const dynamic = "force-dynamic"

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response

  const { supabase, tenantId } = session.context
  const { id: bookingId } = await context.params

  let data: Awaited<ReturnType<typeof fetchDebriefData>>
  try {
    data = await fetchDebriefData(supabase, tenantId, bookingId)
  } catch (error) {
    logError("[api] Failed to load debrief PDF data", { error, tenantId, bookingId })
    return noStoreJson({ error: "Failed to load debrief" }, { status: 500 })
  }

  if (!data.booking) {
    return noStoreJson({ error: "Booking not found" }, { status: 404 })
  }

  if (!data.lessonProgress) {
    return noStoreJson({ error: "No debrief has been written for this booking yet" }, { status: 422 })
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("name, logo_url, timezone")
    .eq("id", tenantId)
    .maybeSingle()

  if (tenantError) {
    logError("[api] Failed to load tenant branding for debrief PDF", { tenantError, tenantId, bookingId })
    return noStoreJson({ error: "Failed to load debrief branding" }, { status: 500 })
  }

  const tenantName = tenant?.name ?? "Your Aero Club"
  const timeZone = tenant?.timezone?.trim() || "Pacific/Auckland"

  try {
    const pdfProps = await buildDebriefReportPdfProps({
      tenantName,
      logoUrl: tenant?.logo_url,
      timeZone,
      booking: data.booking,
      lessonProgress: data.lessonProgress,
      flightExperiences: data.flightExperiences,
    })

    const filename = buildDebriefPdfFilename(pdfProps.lessonName)
    const pdfDocument = React.createElement(DebriefReportPDF, pdfProps)
    const pdfBlob = await pdf(pdfDocument as unknown as React.ReactElement<DocumentProps>).toBlob()
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    logError("[api] Failed to render debrief PDF", { error, tenantId, bookingId })
    return noStoreJson({ error: "Failed to generate debrief PDF" }, { status: 500 })
  }
}
