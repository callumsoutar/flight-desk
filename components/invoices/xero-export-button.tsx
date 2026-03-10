"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export function XeroExportButton({
  invoiceId,
  mode,
  onDone,
}: {
  invoiceId: string
  mode: "export" | "retry"
  onDone?: () => void
}) {
  const [isSubmitting, startTransition] = React.useTransition()

  const handleClick = React.useCallback(() => {
    startTransition(async () => {
      const endpoint = mode === "retry" ? "/api/xero/retry-export" : "/api/xero/export-invoices"
      const payload =
        mode === "retry" ? { invoiceId } : { invoiceIds: [invoiceId] }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })

      const body = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(
          body && typeof body === "object" && typeof body.error === "string"
            ? body.error
            : "Xero export failed"
        )
        return
      }

      toast.success(mode === "retry" ? "Retry export started" : "Export started")
      onDone?.()
    })
  }, [invoiceId, mode, onDone])

  return (
    <Button type="button" size="sm" variant={mode === "retry" ? "outline" : "default"} onClick={handleClick} disabled={isSubmitting}>
      {isSubmitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
      {mode === "retry" ? "Retry Export" : "Export to Xero"}
    </Button>
  )
}
