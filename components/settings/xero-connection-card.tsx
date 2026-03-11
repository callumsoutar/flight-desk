"use client"

import { Building2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function XeroConnectionCard({
  connected,
  tenantName,
  connectedAt,
  onRefresh,
}: {
  connected: boolean
  tenantName: string | null
  connectedAt: string | null
  onRefresh?: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Xero Connection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!connected ? (
          <>
            <p className="text-sm text-muted-foreground">Connect your Xero organisation to enable account sync and invoice export.</p>
            <Button asChild>
              <a href="/api/xero/connect">Connect to Xero</a>
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm">
              Connected to <span className="font-semibold">{tenantName ?? "Xero tenant"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Connected at: {connectedAt ? new Date(connectedAt).toLocaleString() : "Unknown"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  const response = await fetch("/api/xero/disconnect", { method: "POST" })
                  if (!response.ok) {
                    toast.error("Failed to disconnect Xero")
                    return
                  }
                  toast.success("Disconnected from Xero")
                  onRefresh?.()
                }}
              >
                Disconnect
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  const response = await fetch("/api/xero/sync-accounts", { method: "POST" })
                  if (!response.ok) {
                    toast.error("Failed to refresh Xero accounts cache")
                    return
                  }
                  toast.success("Xero accounts cache refreshed")
                  onRefresh?.()
                }}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                Refresh Account Cache
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
