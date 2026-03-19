import * as React from "react"
import { redirect } from "next/navigation"

import { InvoicesPageClient } from "@/components/invoices/invoices-page-client"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { RoleGuard } from "@/components/auth/role-guard"
import { getAuthSession } from "@/lib/auth/session"
import { fetchInvoices } from "@/lib/invoices/fetch-invoices"
import { fetchXeroSettings } from "@/lib/settings/fetch-xero-settings"
import { createSupabaseServerClient } from "@/lib/supabase/server"

async function InvoicesContent({ tenantId }: { tenantId: string }) {
  const supabase = await createSupabaseServerClient()

  let loadError: string | null = null

  const [xeroSettingsResult, invoicesResult] = await Promise.all([
    fetchXeroSettings(supabase, tenantId).catch(() => null),
    fetchInvoices(supabase, tenantId, undefined, true).catch(() => null),
  ])

  const xeroEnabled = xeroSettingsResult?.enabled ?? false
  const invoices = invoicesResult ?? []
  if (!invoicesResult) {
    loadError = "Failed to load invoices."
  }

  return (
    <>
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      <InvoicesPageClient invoices={invoices} xeroEnabled={xeroEnabled} />
    </>
  )
}

export default async function InvoicesPage() {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

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

  return (
    <RoleGuard allowedRoles={["owner", "admin", "instructor"]}>
      <AppRouteShell>
        <AppRouteListContainer>
          <React.Suspense fallback={<ListPageSkeleton showTabs />}>
            <InvoicesContent tenantId={tenantId} />
          </React.Suspense>
        </AppRouteListContainer>
      </AppRouteShell>
    </RoleGuard>
  )
}
