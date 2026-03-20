"use client"

import * as React from "react"
import Image from "next/image"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

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
  const [isDisconnecting, setIsDisconnecting] = React.useState(false)

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Image src="/images/xero-logo.png" alt="Xero" width={72} height={24} className="h-6 w-auto" />
          <h3 className="text-base font-semibold text-slate-900">Xero</h3>
        </div>
        {!connected ? (
          <Button asChild>
            <a href="/api/xero/connect">Connect</a>
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={isDisconnecting}
            onClick={async () => {
              try {
                setIsDisconnecting(true)
                const response = await fetch("/api/xero/disconnect", { method: "POST" })
                if (!response.ok) {
                  toast.error("Failed to disconnect Xero")
                  return
                }
                toast.success("Disconnected from Xero")
                onRefresh?.()
              } catch {
                toast.error("Failed to disconnect Xero")
              } finally {
                setIsDisconnecting(false)
              }
            }}
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
          </Button>
        )}
      </div>

      {!connected ? (
        <p className="text-sm text-muted-foreground">
          Connect your Xero organisation to enable account sync and invoice export.
        </p>
      ) : (
        <div className="space-y-1">
          <p className="text-sm">
            Connected to <span className="font-semibold">{tenantName ?? "Xero tenant"}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Connected at: {connectedAt ? new Date(connectedAt).toLocaleString() : "Unknown"}
          </p>
        </div>
      )}
    </section>
  )
}
