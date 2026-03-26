"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import { toast } from "sonner"

import { approveDraftInvoiceAction } from "@/app/invoices/[id]/actions"
import InvoiceActionsToolbar from "@/components/invoices/invoice-actions-toolbar"
import InvoiceDocumentView from "@/components/invoices/invoice-document-view"
import InvoiceViewActions from "@/components/invoices/invoice-view-actions"
import type { UserResult } from "@/components/invoices/member-select"
import { Card } from "@/components/ui/card"
import { invoiceDetailQueryKey, useInvoiceDetailQuery } from "@/hooks/use-invoice-detail-query"
import { invoicesQueryKey } from "@/hooks/use-invoices-query"
import { roundToTwoDecimals } from "@/lib/invoices/invoice-calculations"
import {
  DEFAULT_INVOICING_SETTINGS,
  type InvoicingSettings,
} from "@/lib/invoices/invoicing-settings"
import type { InvoiceItemsRow } from "@/lib/types"
import type { InvoiceWithRelations } from "@/lib/types/invoices"

export function InvoiceDetailClient({
  invoice,
  items,
  settings = DEFAULT_INVOICING_SETTINGS,
  loadErrors = [],
  canApproveDraft = false,
  xeroEnabled = false,
  xeroStatus = null,
}: {
  invoice: InvoiceWithRelations
  items: InvoiceItemsRow[]
  settings?: InvoicingSettings
  loadErrors?: string[]
  canApproveDraft?: boolean
  xeroEnabled?: boolean
  xeroStatus?: {
    export_status: "pending" | "exported" | "failed" | "voided"
    xero_invoice_id: string | null
    exported_at: string | null
    error_message: string | null
  } | null
}) {
  const queryClient = useQueryClient()
  const [isApproving, startApproveTransition] = React.useTransition()
  const { data } = useInvoiceDetailQuery({
    invoice,
    items,
    xeroStatus,
  })
  const liveInvoice = data.invoice
  const liveItems = data.items
  const liveXeroStatus = data.xeroStatus

  const selectedMember = React.useMemo<UserResult | null>(() => {
    if (!liveInvoice.user || !liveInvoice.user.id || !liveInvoice.user.email) return null
    return {
      id: liveInvoice.user.id,
      first_name: liveInvoice.user.first_name,
      last_name: liveInvoice.user.last_name,
      email: liveInvoice.user.email ?? "",
    }
  }, [liveInvoice.user])

  const subtotal = roundToTwoDecimals(liveItems.reduce((sum, item) => sum + (item.amount || 0), 0))
  const totalTax = roundToTwoDecimals(liveItems.reduce((sum, item) => sum + (item.tax_amount || 0), 0))
  const total = roundToTwoDecimals(liveItems.reduce((sum, item) => sum + (item.line_total || 0), 0))

  const billToName =
    (selectedMember
      ? `${selectedMember.first_name || ""} ${selectedMember.last_name || ""}`.trim() || selectedMember.email
      : liveInvoice.user_id) || liveInvoice.user_id

  const isXeroLocked = liveXeroStatus?.export_status === "exported"
  const isReadOnly = isXeroLocked

  const handleApprove = React.useCallback(() => {
    if (liveInvoice.status !== "draft") return

    startApproveTransition(async () => {
      const result = await approveDraftInvoiceAction({ invoiceId: liveInvoice.id })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("Invoice approved")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: invoiceDetailQueryKey(liveInvoice.id) }),
        queryClient.invalidateQueries({ queryKey: invoicesQueryKey(xeroEnabled) }),
      ])
    })
  }, [liveInvoice.status, liveInvoice.id, queryClient, xeroEnabled])

  return (
    <div className="flex flex-1 flex-col bg-muted/20">
      <div className="mx-auto w-full max-w-[920px] px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
        <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6 sm:py-3.5 lg:-mx-10 lg:px-10">
          <InvoiceActionsToolbar
            mode={isReadOnly ? "view" : "edit"}
            invoiceId={liveInvoice.id}
            invoiceNumber={liveInvoice.invoice_number}
            status={liveInvoice.status}
            isXeroLocked={isXeroLocked}
            member={selectedMember}
            rightSlot={
              liveInvoice.status !== "draft" ? (
                <InvoiceViewActions
                  invoiceId={liveInvoice.id}
                  billToEmail={liveInvoice.user?.email || selectedMember?.email || null}
                  status={liveInvoice.status}
                  settings={settings}
                  xeroEnabled={xeroEnabled}
                  xeroStatus={liveXeroStatus}
                  bookingId={liveInvoice.booking_id}
                  invoice={{
                    invoiceNumber: liveInvoice.invoice_number || `#${liveInvoice.id.slice(0, 8)}`,
                    issueDate: liveInvoice.issue_date,
                    dueDate: liveInvoice.due_date,
                    taxRate: liveInvoice.tax_rate,
                    subtotal: liveInvoice.subtotal ?? subtotal,
                    taxTotal: liveInvoice.tax_total ?? totalTax,
                    totalAmount: liveInvoice.total_amount ?? total,
                    totalPaid: liveInvoice.total_paid ?? 0,
                    balanceDue:
                      liveInvoice.balance_due ??
                      Math.max(0, (liveInvoice.total_amount ?? total) - (liveInvoice.total_paid ?? 0)),
                    billToName,
                  }}
                  items={liveItems.map((item) => ({
                    id: item.id,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    rate_inclusive: item.rate_inclusive,
                    line_total: item.line_total,
                  }))}
                />
              ) : null
            }
            onApprove={
              canApproveDraft && liveInvoice.status === "draft" && !isXeroLocked ? handleApprove : undefined
            }
            saveDisabled
            approveDisabled={isApproving}
            approveLoading={isApproving}
            showApprove={canApproveDraft && liveInvoice.status === "draft" && !isXeroLocked}
          />
        </div>

        {loadErrors.length > 0 ? (
          <p className="mt-4 text-sm text-amber-700">Some sections failed to load: {loadErrors.join(", ")}</p>
        ) : null}

        <div className="mt-6 space-y-6">
          <InvoiceDocumentView
            settings={settings}
            invoice={{
              invoiceNumber: liveInvoice.invoice_number || `#${liveInvoice.id.slice(0, 8)}`,
              issueDate: liveInvoice.issue_date,
              dueDate: liveInvoice.due_date,
              taxRate: liveInvoice.tax_rate,
              subtotal: liveInvoice.subtotal ?? subtotal,
              taxTotal: liveInvoice.tax_total ?? totalTax,
              totalAmount: liveInvoice.total_amount ?? total,
              totalPaid: liveInvoice.total_paid ?? 0,
              balanceDue:
                liveInvoice.balance_due ??
                Math.max(0, (liveInvoice.total_amount ?? total) - (liveInvoice.total_paid ?? 0)),
              billToName,
            }}
            items={liveItems.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              rate_inclusive: item.rate_inclusive,
              line_total: item.line_total,
            }))}
          />

          <Card className="shadow-sm ring-1 ring-border/40">
            <div className="p-6">
              <div className="text-base font-semibold">Notes</div>
              <div className="mt-1 text-sm text-muted-foreground">Optional internal notes for this invoice.</div>

              <details className="group mt-4 w-full">
                <summary className="flex w-full cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 group-open:rotate-90" />
                  <span>{liveInvoice.notes ? "View notes" : "No notes"}</span>
                </summary>
                <div className="pt-3">
                  <textarea
                    className="min-h-[120px] w-full resize-vertical rounded-md border border-input bg-background px-3 py-2 text-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={liveInvoice.notes || ""}
                    readOnly
                  />
                </div>
              </details>
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}
