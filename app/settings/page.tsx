import * as React from "react"
import { redirect } from "next/navigation"

import { SettingsPageClient } from "@/components/settings/settings-page-client"
import { SettingsPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { getAuthSession } from "@/lib/auth/session"
import { fetchBookingsSettings } from "@/lib/settings/fetch-bookings-settings"
import { fetchGeneralSettings } from "@/lib/settings/fetch-general-settings"
import { fetchInvoicingSettings } from "@/lib/settings/fetch-invoicing-settings"
import { fetchMembershipsSettings } from "@/lib/settings/fetch-memberships-settings"
import { fetchXeroSettings } from "@/lib/settings/fetch-xero-settings"
import { createSupabaseServerClient } from "@/lib/supabase/server"

async function SettingsContent({
  tenantId,
  canManageSettings,
}: {
  tenantId: string
  canManageSettings: boolean
}) {
  const supabase = await createSupabaseServerClient()

  let generalSettings: Awaited<ReturnType<typeof fetchGeneralSettings>> | null = null
  let generalLoadError: string | null = null
  let invoicingSettings: Awaited<ReturnType<typeof fetchInvoicingSettings>> | null = null
  let invoicingLoadError: string | null = null
  let bookingsSettings: Awaited<ReturnType<typeof fetchBookingsSettings>> | null = null
  let bookingsLoadError: string | null = null
  let membershipsSettings: Awaited<ReturnType<typeof fetchMembershipsSettings>> | null = null
  let membershipsLoadError: string | null = null
  let xeroSettings: Awaited<ReturnType<typeof fetchXeroSettings>> | null = null
  let xeroLoadError: string | null = null
  let xeroConnectionStatus: { connected: boolean; xero_tenant_name: string | null; connected_at: string | null } =
    {
      connected: false,
      xero_tenant_name: null,
      connected_at: null,
    }

  try {
    generalSettings = await fetchGeneralSettings(supabase, tenantId)
  } catch {
    generalSettings = null
    generalLoadError = "Failed to load settings."
  }

  try {
    invoicingSettings = await fetchInvoicingSettings(supabase, tenantId)
  } catch {
    invoicingSettings = null
    invoicingLoadError = "Failed to load settings."
  }

  try {
    bookingsSettings = await fetchBookingsSettings(supabase, tenantId)
  } catch {
    bookingsSettings = null
    bookingsLoadError = "Failed to load booking settings."
  }

  try {
    membershipsSettings = await fetchMembershipsSettings(supabase, tenantId)
  } catch {
    membershipsSettings = null
    membershipsLoadError = "Failed to load membership settings."
  }

  try {
    xeroSettings = await fetchXeroSettings(supabase, tenantId)
    const { data: connection } = await supabase
      .from("xero_connections")
      .select("xero_tenant_name, created_at")
      .eq("tenant_id", tenantId)
      .maybeSingle()

    xeroConnectionStatus = {
      connected: Boolean(connection),
      xero_tenant_name: connection?.xero_tenant_name ?? null,
      connected_at: xeroSettings.connected_at ?? connection?.created_at ?? null,
    }
  } catch {
    xeroSettings = null
    xeroLoadError = "Failed to load Xero settings."
  }

  return (
    <SettingsPageClient
      canManageSettings={canManageSettings}
      initialGeneralSettings={generalSettings}
      generalLoadError={generalLoadError}
      initialInvoicingSettings={invoicingSettings}
      invoicingLoadError={invoicingLoadError}
      initialBookingsSettings={bookingsSettings}
      bookingsLoadError={bookingsLoadError}
      initialMembershipsSettings={membershipsSettings}
      membershipsLoadError={membershipsLoadError}
      initialXeroSettings={xeroSettings}
      xeroLoadError={xeroLoadError}
      xeroConnectionStatus={xeroConnectionStatus}
    />
  )
}

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
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

  const canManageSettings = role === "owner" || role === "admin"
  if (!canManageSettings) {
    return (
      <AppRouteShell>
        <AppRouteListContainer>
          <RouteNotFoundState
            heading="Access denied"
            message="You do not have permission to access settings. Only owners and admins can configure company settings."
          />
        </AppRouteListContainer>
      </AppRouteShell>
    )
  }

  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <React.Suspense fallback={<SettingsPageSkeleton />}>
          <SettingsContent tenantId={tenantId} canManageSettings={canManageSettings} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
