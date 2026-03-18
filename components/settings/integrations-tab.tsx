"use client"

import * as React from "react"

import { XeroConnectionCard } from "@/components/settings/xero-connection-card"
import { XeroSettingsForm } from "@/components/settings/xero-settings-form"
import type { XeroSettings } from "@/lib/settings/xero-settings"

export function IntegrationsTab({
  initialXeroSettings,
  xeroLoadError,
  xeroConnectionStatus,
}: {
  initialXeroSettings: XeroSettings | null
  xeroLoadError: string | null
  xeroConnectionStatus: {
    connected: boolean
    xero_tenant_name: string | null
    connected_at: string | null
  }
}) {
  const [refreshKey, setRefreshKey] = React.useState(0)
  const settings = initialXeroSettings

  return (
    <div className="space-y-6" key={refreshKey}>
      {xeroLoadError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Xero settings unavailable: {xeroLoadError}
        </div>
      ) : null}

      <XeroConnectionCard
        connected={xeroConnectionStatus.connected}
        tenantName={xeroConnectionStatus.xero_tenant_name}
        connectedAt={xeroConnectionStatus.connected_at}
        onRefresh={() => setRefreshKey((value) => value + 1)}
      />

      {xeroConnectionStatus.connected && settings ? (
        <XeroSettingsForm settings={settings} onSaved={() => setRefreshKey((value) => value + 1)} />
      ) : null}
    </div>
  )
}
