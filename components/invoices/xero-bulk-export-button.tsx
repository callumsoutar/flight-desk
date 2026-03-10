"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export function XeroBulkExportButton({
  invoiceIds,
  disabled,
  onDone,
}: {
  invoiceIds: string[]
  disabled?: boolean
  onDone?: () => void
}) {
  const [loading, startTransition] = React.useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || loading || invoiceIds.length === 0}
      onClick={() => {
        startTransition(async () => {
          const response = await fetch("/api/xero/export-invoices", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ invoiceIds }),
          })
          if (!response.ok) {
            toast.error("Failed to export selected invoices")
            return
          }
          toast.success("Invoices sent to Xero")
          onDone?.()
        })
      }}
    >
      Export to Xero
    </Button>
  )
}
