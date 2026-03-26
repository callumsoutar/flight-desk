"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { XeroConnectionCard } from "@/components/settings/xero-connection-card"
import { XeroSettingsForm } from "@/components/settings/xero-settings-form"
import { xeroSettingsQueryKey, useXeroSettingsQuery } from "@/hooks/use-xero-settings-query"
import { xeroStatusQueryKey, useXeroStatusQuery } from "@/hooks/use-xero-status-query"
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
  const queryClient = useQueryClient()
  const { data: xeroStatus } = useXeroStatusQuery({
    connected: xeroConnectionStatus.connected,
    xero_tenant_name: xeroConnectionStatus.xero_tenant_name,
    connected_at: xeroConnectionStatus.connected_at,
    enabled: initialXeroSettings?.enabled ?? false,
  })
  const { data: settings } = useXeroSettingsQuery(initialXeroSettings)

  const refreshXero = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: xeroStatusQueryKey() }),
      queryClient.invalidateQueries({ queryKey: xeroSettingsQueryKey() }),
    ])
  }, [queryClient])

  return (
    <div className="space-y-6">
      {xeroLoadError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Xero settings unavailable: {xeroLoadError}
        </div>
      ) : null}

      <XeroConnectionCard
        connected={xeroStatus?.connected ?? false}
        tenantName={xeroStatus?.xero_tenant_name ?? null}
        connectedAt={xeroStatus?.connected_at ?? null}
        onRefresh={() => void refreshXero()}
      />

      {xeroStatus?.connected && settings ? (
        <XeroSettingsForm settings={settings} onSaved={() => void refreshXero()} />
      ) : null}
    </div>
  )
}
