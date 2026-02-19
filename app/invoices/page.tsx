import * as React from "react"
import { redirect } from "next/navigation"

import { InvoicesPageClient } from "@/components/invoices/invoices-page-client"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { fetchInvoices } from "@/lib/invoices/fetch-invoices"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { InvoiceWithRelations } from "@/lib/types/invoices"

function MessageCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}

async function InvoicesContent({ tenantId }: { tenantId: string }) {
  const supabase = await createSupabaseServerClient()

  let invoices: InvoiceWithRelations[] = []
  let loadError: string | null = null

  try {
    invoices = await fetchInvoices(supabase, tenantId)
  } catch {
    invoices = []
    loadError = "Failed to load invoices."
  }

  return (
    <>
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      <InvoicesPageClient invoices={invoices} />
    </>
  )
}

export default async function InvoicesPage() {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

  if (!user) redirect("/login")
  if (!tenantId) {
    return (
      <MessageCard
        title="Invoices"
        description="Your account isn&apos;t linked to a tenant yet."
      />
    )
  }

  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <React.Suspense fallback={<ListPageSkeleton showTabs />}>
          <InvoicesContent tenantId={tenantId} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
