import * as React from "react"
import { redirect } from "next/navigation"

import { InvoicesPageClient } from "@/components/invoices/invoices-page-client"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { getAuthSession } from "@/lib/auth/session"
import { fetchInvoiceCreateData } from "@/lib/invoices/fetch-invoice-create-data"
import { fetchInvoices } from "@/lib/invoices/fetch-invoices"
import { fetchXeroSettings } from "@/lib/settings/fetch-xero-settings"
import { createSupabaseServerClient } from "@/lib/supabase/server"

async function InvoicesContent({ tenantId }: { tenantId: string }) {
  const supabase = await createSupabaseServerClient()

  let loadError: string | null = null

  const [xeroSettingsResult, invoicesResult, createDataResult] = await Promise.all([
    fetchXeroSettings(supabase, tenantId).catch(() => null),
    fetchInvoices(supabase, tenantId, undefined, true).catch(() => null),
    fetchInvoiceCreateData(supabase, tenantId).catch(() => null),
  ])

  const xeroEnabled = xeroSettingsResult?.enabled ?? false
  const invoices = invoicesResult ?? []
  const members = createDataResult?.members ?? []
  if (!invoicesResult) {
    loadError = "Failed to load invoices."
  }

  return (
    <>
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      <InvoicesPageClient invoices={invoices} members={members} xeroEnabled={xeroEnabled} />
    </>
  )
}

export default async function InvoicesPage() {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId, role } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    authoritativeRole: true,
  })

  if (!user) redirect("/login")
  if (!tenantId) {
    return (
      <AppRouteShell>
        <AppRouteListContainer>
          <RouteNotFoundState
            heading="Account not set up"
            message="Your account hasn't been fully set up yet. Please contact your administrator."
          />
        </AppRouteListContainer>
      </AppRouteShell>
    )
  }
  if (!role || !["owner", "admin", "instructor"].includes(role)) redirect("/dashboard")

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
