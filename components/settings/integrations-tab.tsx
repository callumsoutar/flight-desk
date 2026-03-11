"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { XeroConnectionCard } from "@/components/settings/xero-connection-card"
import { XeroSettingsForm } from "@/components/settings/xero-settings-form"
import { Card, CardContent } from "@/components/ui/card"
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
  const { data: taxMismatches = [] } = useQuery({
    queryKey: ["xero", "tax-mismatch-exports", refreshKey],
    queryFn: async () => {
      const response = await fetch("/api/xero/tax-mismatch-exports", { cache: "no-store" })
      if (!response.ok) return [] as Array<{ invoice_id: string; invoice_number: string; tax_total: number }>
      const body = (await response.json().catch(() => null)) as {
        mismatches?: Array<{ invoice_id: string; invoice_number: string; tax_total: number }>
      } | null
      return body?.mismatches ?? []
    },
    enabled: xeroConnectionStatus.connected,
    staleTime: 60_000,
  })

  return (
    <div className="space-y-6" key={refreshKey}>
      {xeroLoadError ? (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            Xero settings unavailable: {xeroLoadError}
          </CardContent>
        </Card>
      ) : null}

      <XeroConnectionCard
        connected={xeroConnectionStatus.connected}
        tenantName={xeroConnectionStatus.xero_tenant_name}
        connectedAt={xeroConnectionStatus.connected_at}
        onRefresh={() => setRefreshKey((value) => value + 1)}
      />

      {taxMismatches.length > 0 ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="space-y-2 pt-6 text-sm text-amber-900">
            <p className="font-medium">
              {taxMismatches.length} exported invoice(s) have local tax but were exported with TaxType NONE.
            </p>
            <p className="text-xs">
              Manual remediation is required in Xero. Review these invoice numbers:
              {" "}
              {taxMismatches.slice(0, 5).map((row) => row.invoice_number).join(", ")}
              {taxMismatches.length > 5 ? "..." : ""}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {xeroConnectionStatus.connected && settings ? (
        <XeroSettingsForm settings={settings} onSaved={() => setRefreshKey((value) => value + 1)} />
      ) : null}
    </div>
  )
}
