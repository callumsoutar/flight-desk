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

async function SettingsContent() {
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
      <RouteNotFoundState
        heading="Account not set up"
        message="Your account hasn't been fully set up yet. Please contact your administrator."
      />
    )
  }

  const canManageSettings = role === "owner" || role === "admin"
  if (!canManageSettings) {
    return (
      <RouteNotFoundState
        heading="Access denied"
        message="You do not have permission to access settings. Only owners and admins can configure company settings."
      />
    )
  }

  const [
    generalResult,
    invoicingResult,
    bookingsResult,
    membershipsResult,
    xeroResult,
    xeroConnectionResult,
  ] = await Promise.allSettled([
    fetchGeneralSettings(supabase, tenantId),
    fetchInvoicingSettings(supabase, tenantId),
    fetchBookingsSettings(supabase, tenantId),
    fetchMembershipsSettings(supabase, tenantId),
    fetchXeroSettings(supabase, tenantId),
    supabase
      .from("xero_connections")
      .select("xero_tenant_name, created_at")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ])

  const generalSettings = generalResult.status === "fulfilled" ? generalResult.value : null
  const generalLoadError = generalResult.status === "rejected" ? "Failed to load settings." : null

  const invoicingSettings = invoicingResult.status === "fulfilled" ? invoicingResult.value : null
  const invoicingLoadError =
    invoicingResult.status === "rejected" ? "Failed to load settings." : null

  const bookingsSettings = bookingsResult.status === "fulfilled" ? bookingsResult.value : null
  const bookingsLoadError =
    bookingsResult.status === "rejected" ? "Failed to load booking settings." : null

  const membershipsSettings = membershipsResult.status === "fulfilled" ? membershipsResult.value : null
  const membershipsLoadError =
    membershipsResult.status === "rejected" ? "Failed to load membership settings." : null

  const xeroSettings = xeroResult.status === "fulfilled" ? xeroResult.value : null
  const xeroLoadError = xeroResult.status === "rejected" ? "Failed to load Xero settings." : null

  const xeroConnection =
    xeroConnectionResult.status === "fulfilled" && !xeroConnectionResult.value.error
      ? xeroConnectionResult.value.data
      : null

  let xeroConnectionStatus: { connected: boolean; xero_tenant_name: string | null; connected_at: string | null } =
    {
      connected: false,
      xero_tenant_name: null,
      connected_at: null,
    }

  if (xeroSettings || xeroConnection) {
    xeroConnectionStatus = {
      connected: Boolean(xeroConnection),
      xero_tenant_name: xeroConnection?.xero_tenant_name ?? null,
      connected_at: xeroSettings?.connected_at ?? xeroConnection?.created_at ?? null,
    }
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
  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <React.Suspense fallback={<SettingsPageSkeleton />}>
          <SettingsContent />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
