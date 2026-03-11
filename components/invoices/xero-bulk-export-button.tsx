"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

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
            const response = await fetch("/api/xero/export-invoices", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ invoiceIds: batch }),
            })

            const body = await response.json().catch(() => null)
            if (!response.ok) {
              toast.error(
                body && typeof body === "object" && typeof body.error === "string"
                  ? body.error
                  : "Failed to export invoices"
              )
              return
            }

            if (body && typeof body === "object" && Array.isArray(body.results)) {
              results.push(...(body.results as ExportResult[]))
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
