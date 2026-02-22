import * as React from "react"
import { redirect } from "next/navigation"

import { InvoiceDetailClient } from "@/components/invoices/invoice-detail-client"
import { InvoiceDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { fetchInvoiceDetail } from "@/lib/invoices/fetch-invoice-detail"
import { fetchInvoicingSettings } from "@/lib/invoices/fetch-invoicing-settings"
import { DEFAULT_INVOICING_SETTINGS } from "@/lib/invoices/invoicing-settings"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ id: string }>
}

function MessageCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <AppRouteShell>
      <AppRouteNarrowDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteNarrowDetailContainer>
    </AppRouteShell>
  )
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

  let detail: Awaited<ReturnType<typeof fetchInvoiceDetail>>
  try {
    detail = await fetchInvoiceDetail(supabase, tenantId, id)
  } catch {
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

  const loadErrors: string[] = []
  let settings = DEFAULT_INVOICING_SETTINGS
  try {
    settings = await fetchInvoicingSettings(supabase, tenantId)
  } catch {
    loadErrors.push("invoicing settings")
  }

  if (!detail.invoice) {
    return (
      <AppRouteNarrowDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Invoice Not Found</CardTitle>
            <CardDescription>This invoice does not exist in your tenant.</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteNarrowDetailContainer>
    )
  }

  return (
    <InvoiceDetailClient
      invoice={detail.invoice}
      items={detail.items}
      settings={settings}
      loadErrors={loadErrors}
      canApproveDraft={canApproveDraft}
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
      <MessageCard
        title="Invoice"
        description="Your account isn't linked to a tenant yet."
      />
    )
  }

  if (id === "new") {
    return (
      <MessageCard
        title="New Invoice"
        description="Invoice creation is not available on this route yet."
      />
    )
  }

  const canApproveDraft = role === "owner" || role === "admin" || role === "instructor"

  return (
    <AppRouteShell>
      <React.Suspense fallback={<InvoiceDetailSkeleton />}>
        <InvoiceDetailContent tenantId={tenantId} id={id} canApproveDraft={canApproveDraft} />
      </React.Suspense>
    </AppRouteShell>
  )
}
