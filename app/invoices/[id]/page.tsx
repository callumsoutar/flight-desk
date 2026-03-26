import * as React from "react"
import { notFound, redirect } from "next/navigation"

import { InvoiceDetailClient } from "@/components/invoices/invoice-detail-client"
import { InvoiceDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { fetchInvoiceDetail } from "@/lib/invoices/fetch-invoice-detail"
import { fetchInvoicingSettings } from "@/lib/invoices/fetch-invoicing-settings"
import { DEFAULT_INVOICING_SETTINGS } from "@/lib/invoices/invoicing-settings"
import { fetchXeroSettings } from "@/lib/settings/fetch-xero-settings"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ id: string }>
}

async function InvoiceDetailContent({
  tenantId,
  id,
  canApproveDraft,
}: {
  tenantId: string
  id: string
  canApproveDraft: boolean
}) {
  const supabase = await createSupabaseServerClient()

  const loadErrors: string[] = []
  let settings = DEFAULT_INVOICING_SETTINGS
  let xeroEnabled = false

  const [detailResult, settingsResult, xeroSettingsResult] = await Promise.all([
    fetchInvoiceDetail(supabase, tenantId, id).catch(() => null),
    fetchInvoicingSettings(supabase, tenantId).catch(() => null),
    fetchXeroSettings(supabase, tenantId).catch(() => null),
  ])

  if (!detailResult) {
    return (
      <AppRouteNarrowDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Invoice</CardTitle>
            <CardDescription>Failed to load invoice. Please try again.</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteNarrowDetailContainer>
    )
  }

  const detail = detailResult

  if (settingsResult) {
    settings = settingsResult
  } else {
    loadErrors.push("invoicing settings")
  }

  xeroEnabled = xeroSettingsResult?.enabled ?? false

  if (!detail.invoice) {
    notFound()
  }

  return (
    <InvoiceDetailClient
      invoice={detail.invoice}
      items={detail.items}
      settings={settings}
      loadErrors={loadErrors}
      canApproveDraft={canApproveDraft}
      xeroEnabled={xeroEnabled}
      xeroStatus={null}
    />
  )
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { user, tenantId, role } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    authoritativeTenant: true,
    authoritativeRole: true,
  })

  if (!user) redirect("/login")
  if (!tenantId) {
    return (
      <AppRouteShell>
        <AppRouteNarrowDetailContainer>
          <RouteNotFoundState
            heading="Account not set up"
            message="Your account hasn't been fully set up yet. Please contact your administrator."
          />
        </AppRouteNarrowDetailContainer>
      </AppRouteShell>
    )
  }

  if (id === "new") {
    return (
      <AppRouteShell>
        <AppRouteNarrowDetailContainer>
          <RouteNotFoundState
            heading="Not available"
            message="Invoice creation is not available on this route yet."
            backHref="/invoices"
            backLabel="Back to invoices"
          />
        </AppRouteNarrowDetailContainer>
      </AppRouteShell>
    )
  }

  if (!role || !["owner", "admin", "instructor"].includes(role)) redirect("/dashboard")
  const canApproveDraft = role === "owner" || role === "admin" || role === "instructor"

  return (
    <AppRouteShell>
      <React.Suspense fallback={<InvoiceDetailSkeleton />}>
        <InvoiceDetailContent tenantId={tenantId} id={id} canApproveDraft={canApproveDraft} />
      </React.Suspense>
    </AppRouteShell>
  )
}
