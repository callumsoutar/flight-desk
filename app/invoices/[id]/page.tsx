import * as React from "react"
import { redirect } from "next/navigation"

import { InvoiceDetailClient } from "@/components/invoices/invoice-detail-client"
import { InvoiceDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchInvoiceDetail } from "@/lib/invoices/fetch-invoice-detail"
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

async function InvoiceDetailContent({ tenantId, id }: { tenantId: string; id: string }) {
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

  return <InvoiceDetailClient invoice={detail.invoice} items={detail.items} />
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) redirect("/login")

  const tenantId = await getUserTenantId(supabase, user.id)
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

  return (
    <AppRouteShell>
      <React.Suspense fallback={<InvoiceDetailSkeleton />}>
        <InvoiceDetailContent tenantId={tenantId} id={id} />
      </React.Suspense>
    </AppRouteShell>
  )
}
