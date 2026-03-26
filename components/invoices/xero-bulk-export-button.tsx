"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { exportInvoicesToXeroMutation } from "@/hooks/use-invoice-detail-query"

type ExportResult = {
  invoiceId: string
  status: "exported" | "failed" | "skipped"
  error?: string
  reason?: string
  xeroInvoiceId?: string | null
}

const MAX_BATCH = 100

export function XeroBulkExportButton({
  invoiceIds,
  disabled,
  label,
  variant = "outline",
  size = "sm",
  onDone,
}: {
  invoiceIds: string[]
  disabled?: boolean
  label?: string
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"
  onDone?: (results: ExportResult[]) => void
}) {
  const [loading, startTransition] = React.useTransition()

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || loading || invoiceIds.length === 0}
      onClick={() => {
        startTransition(async () => {
          const uniqueIds = Array.from(new Set(invoiceIds))
          const results: ExportResult[] = []

          for (let i = 0; i < uniqueIds.length; i += MAX_BATCH) {
            const batch = uniqueIds.slice(i, i + MAX_BATCH)
            try {
              const batchResults = await exportInvoicesToXeroMutation(batch)
              results.push(...batchResults)
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to export invoices")
              return
            }
          }

          const exported = results.filter((result) => result.status === "exported").length
          const failed = results.filter((result) => result.status === "failed").length
          const skipped = results.filter((result) => result.status === "skipped").length

          if (failed > 0) {
            toast.error(
              `Exported ${exported} invoice${exported === 1 ? "" : "s"}. ` +
                `${failed} failed${skipped ? `, ${skipped} skipped` : ""}.`
            )
          } else {
            toast.success(
              `Exported ${exported} invoice${exported === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}.`
            )
          }

          onDone?.(results)
        })
      }}
    >
      {label ?? "Export to Xero"}
    </Button>
  )
}
