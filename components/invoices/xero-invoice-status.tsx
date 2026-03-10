"use client"

import { ExternalLink } from "lucide-react"

import { XeroExportButton } from "@/components/invoices/xero-export-button"
import { XeroStatusBadge } from "@/components/invoices/xero-status-badge"

type XeroStatusData = {
  export_status: "pending" | "exported" | "failed"
  xero_invoice_id: string | null
  exported_at: string | null
  error_message: string | null
}

const EXPORTABLE = new Set(["pending", "paid", "overdue"])

export function XeroInvoiceStatus({
  invoiceId,
  invoiceStatus,
  xeroEnabled,
  status,
  onRefresh,
}: {
  invoiceId: string
  invoiceStatus: string
  xeroEnabled: boolean
  status: XeroStatusData | null
  onRefresh?: () => void
}) {
  if (!xeroEnabled) return null

  const canExport = EXPORTABLE.has(invoiceStatus) && !status
  const canRetry = status?.export_status === "failed"
  const canView = status?.export_status === "exported" && status?.xero_invoice_id

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Xero Export</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Export status for this invoice in Xero.
          </div>
        </div>
        <XeroStatusBadge status={status?.export_status ?? null} />
      </div>

      {status?.error_message ? (
        <p className="mt-3 text-sm text-destructive">{status.error_message}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canExport ? <XeroExportButton invoiceId={invoiceId} mode="export" onDone={onRefresh} /> : null}
        {canRetry ? <XeroExportButton invoiceId={invoiceId} mode="retry" onDone={onRefresh} /> : null}
        {canView ? (
          <a
            href={`https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${status?.xero_invoice_id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-sm text-primary hover:underline"
          >
            View in Xero
            <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  )
}
